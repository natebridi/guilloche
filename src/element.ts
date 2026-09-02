// <guilloche-pattern> — the embeddable custom element.
//
// A thin shell over mountGuilloche(), the same one the React <Stage> uses. Its
// only real jobs are translating attributes into params and being a good
// citizen on someone else's page: element-scoped input, no gyro prompt unless
// asked, lazy GL context allocation, and a proper teardown on disconnect.
//
// Config comes in as the SAME string the editor's "Copy link" produces, so a
// shared link and an embed are interchangeable.
//
// The class is built inside a factory rather than declared at module scope.
// `class X extends HTMLElement` EVALUATES HTMLElement at definition time, which
// throws under SSR (Next.js, Astro) the moment this module is imported — a
// guard on the registration alone is not enough.

import { mountGuilloche, type MountHandle } from "./engine/mount";
import {
  WebGL2UnavailableError,
  type ProbeOptions,
  type ProbeResult,
} from "./engine/GuillocheEngine";
import type { GyroState } from "./engine/pointerInput";
import { schemaDefaults } from "./schema";
import { decode } from "./urlState";

const TAG = "guilloche-pattern";

/** Public surface of the element. Type-only, so it erases under SSR. */
export interface GuillochePatternElement extends HTMLElement {
  /** Editor share-link string, e.g. "v1&pr=barleycorn". */
  params: string;
  /** "hover" (default) | "off" | "gyro". */
  interactive: string;
  /**
   * Request device-orientation permission. iOS only grants this from inside a
   * user gesture, so call it from your own click handler if you've hidden the
   * built-in prompt via `::part(gyro-button)`.
   */
  requestGyro(): Promise<GyroState>;
  /**
   * Average colour of the pattern as currently configured, for styling content
   * laid over it. Returns null before the element has a GL context — it is
   * allocated lazily on first intersection, so a probe from a script that runs
   * while the element is still off-screen has nothing to measure yet.
   */
  probe(options?: ProbeOptions): ProbeResult | null;
}

const TEMPLATE = `
<style>
  :host {
    display: block;
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
    /* Isolate layout/paint from the host page. */
    contain: content;
  }
  :host([hidden]) { display: none; }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
  .fallback {
    display: none;
    position: absolute;
    inset: 0;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    font: 14px/1.4 system-ui, sans-serif;
    color: #787d89;
    text-align: center;
  }
  :host([data-state="unsupported"]) canvas { display: none; }
  :host([data-state="unsupported"]) .fallback { display: flex; }

  /* Shown only when device orientation is available but needs a gesture.
     Hide it with ::part(gyro-button) and call requestGyro() yourself. */
  .gyro {
    display: none;
    position: absolute;
    left: 50%;
    bottom: 12px;
    transform: translateX(-50%);
    padding: 7px 14px;
    font: 12px/1 system-ui, sans-serif;
    color: #fff;
    background: rgba(0, 0, 0, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 999px;
    cursor: pointer;
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
  }
  :host([data-gyro="prompt"]) .gyro { display: block; }
</style>
<canvas part="canvas"></canvas>
<button class="gyro" part="gyro-button" type="button">Enable motion</button>
<div class="fallback"><slot>This tool requires WebGL2.</slot></div>
`;

let cached: CustomElementConstructor | null = null;

function buildClass(): CustomElementConstructor {
  return class GuillochePattern extends HTMLElement {
    static readonly observedAttributes = ["params", "interactive", "max-dpr"];

    #canvas: HTMLCanvasElement;
    #gyroButton: HTMLButtonElement;
    #handle: MountHandle | null = null;
    #observer: IntersectionObserver | null = null;
    #visible = false;
    #warnedInsecure = false;

    constructor() {
      super();
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = TEMPLATE;
      this.#canvas = root.querySelector("canvas")!;
      this.#gyroButton = root.querySelector("button.gyro")!;
      // A click listener on a real button is the ONLY reliable way to satisfy
      // iOS's user-gesture requirement for requestPermission(). An ambient
      // pointerdown listener is not: on touch, pointerdown also fires when a
      // scroll begins, which iOS does not treat as user activation.
      this.#gyroButton.addEventListener("click", () => {
        void this.requestGyro();
      });
    }

    requestGyro(): Promise<GyroState> {
      return this.#handle?.requestGyro() ?? Promise.resolve("unsupported");
    }

    probe(options?: ProbeOptions): ProbeResult | null {
      return this.#handle?.engine.probe(options) ?? null;
    }

    // Reflect the two string attributes as properties, so frameworks that set
    // properties rather than attributes (Lit, Vue, React 19) still work.
    get params(): string {
      return this.getAttribute("params") ?? "";
    }
    set params(v: string) {
      this.setAttribute("params", v);
    }
    get interactive(): string {
      return this.getAttribute("interactive") ?? "track";
    }
    set interactive(v: string) {
      this.setAttribute("interactive", v);
    }

    connectedCallback() {
      // Defer the GL context until the element is near the viewport. Browsers
      // cap live contexts per page, so a long page of embeds should only pay
      // for the ones a reader actually reaches.
      if (typeof IntersectionObserver === "undefined") {
        this.#visible = true;
        this.#mount();
        return;
      }
      this.#observer = new IntersectionObserver(
        (entries) => {
          this.#visible = entries.some((e) => e.isIntersecting);
          if (this.#visible) this.#mount();
          // Keep the context once allocated (re-mounting on every scroll would
          // flash); just idle the loop while off-screen.
          this.#handle?.setActive(this.#visible);
        },
        { rootMargin: "200px" },
      );
      this.#observer.observe(this);
    }

    disconnectedCallback() {
      this.#observer?.disconnect();
      this.#observer = null;
      this.#unmount();
    }

    attributeChangedCallback(name: string, prev: string | null, next: string | null) {
      if (prev === next) return;
      if (name === "params") {
        this.#handle?.setParams(this.#params());
        return;
      }
      // interactive / max-dpr are fixed at construction time inside the mount,
      // so they need a remount. Both change rarely enough that this is fine.
      if (this.#handle) {
        this.#unmount();
        this.#mount();
      }
    }

    /** Current params as a full state object (defaults + whatever is set). */
    #params(): Record<string, number> {
      return { ...schemaDefaults(), ...decode(this.getAttribute("params") ?? "").params };
    }

    #mount() {
      if (this.#handle || !this.#visible) return;
      const mode = (this.getAttribute("interactive") ?? "track").toLowerCase();
      const maxDprAttr = Number(this.getAttribute("max-dpr"));

      try {
        this.#handle = mountGuilloche(this.#canvas, {
          params: this.#params(),
          interactive: mode !== "off",
          // "track" (the default) aims from anywhere on the page; element
          // scope stopped aiming as soon as anything was layered over the
          // plate, which read as the light snapping away for no visible
          // reason. "hover" keeps the old element-scoped behaviour for a host
          // that would rather this widget not watch the whole page.
          //
          // The aim always HOLDS its last value when the pointer is lost —
          // losing the pointer says nothing about where the light should be.
          //
          // "gyro" opts into device orientation, which on iOS means a
          // permission prompt, so it is never implicit.
          pointer: {
            scope: mode === "hover" ? "element" : "window",
            resetOnLeave: false,
            gyro: mode === "gyro",
          },
          pointerTarget: this,
          maxDpr: Number.isFinite(maxDprAttr) && maxDprAttr > 0 ? maxDprAttr : undefined,
          onGyroState: (state) => this.#onGyroState(state),
        });
        this.dataset.state = "ready";
        this.dispatchEvent(new CustomEvent("guilloche:ready", { bubbles: true }));
      } catch (err) {
        this.dataset.state = "unsupported";
        // Only a missing context is an expected, quiet outcome. A shader
        // compile/link failure is a real bug and should still be visible.
        if (!(err instanceof WebGL2UnavailableError)) console.error(err);
        this.dispatchEvent(
          new CustomEvent("guilloche:error", { bubbles: true, detail: err }),
        );
      }
    }

    #onGyroState(state: GyroState) {
      // Reflected so consumers can style around it, and so it's inspectable in
      // devtools when someone asks "why isn't the gyro doing anything".
      this.dataset.gyro = state;
      this.dispatchEvent(
        new CustomEvent("guilloche:gyro", { bubbles: true, detail: state }),
      );
      // Device orientation silently does nothing on an insecure origin, which
      // is a configuration mistake the author can't otherwise see. Warn once,
      // and only when they explicitly asked for gyro.
      if (state === "insecure" && !this.#warnedInsecure) {
        this.#warnedInsecure = true;
        console.warn(
          "[guilloche] interactive=\"gyro\" needs a secure context (HTTPS). " +
            `This page is ${location.origin}, so device orientation is unavailable. ` +
            "localhost counts as secure; a LAN IP over http:// does not.",
        );
      }
    }

    #unmount() {
      this.#handle?.destroy();
      this.#handle = null;
      delete this.dataset.gyro;
    }
  };
}

/**
 * Register <guilloche-pattern>. Idempotent, and a no-op outside a browser so
 * importing this from an SSR build doesn't throw.
 */
export function defineGuillocheElement(tag: string = TAG): void {
  if (typeof window === "undefined" || typeof customElements === "undefined") return;
  if (customElements.get(tag)) return;
  cached ??= buildClass();
  customElements.define(tag, cached);
}

declare global {
  interface HTMLElementTagNameMap {
    "guilloche-pattern": GuillochePatternElement;
  }
}
