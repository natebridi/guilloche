import { useState } from "react";
import {
  CodeBlock,
  Icon,
  IconButton,
  Link,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@jig-ui/react";
import { PRESETS, findPreset } from "../src/presets";
import { SCHEMA } from "../src/schema";
import { paramsString, useSlideCarousel, useTweenedParams } from "./patternDemo";

// Preset ids are read from PRESETS rather than written out here, so the page
// cannot drift from the gallery the way the old one had — it still referenced
// `pr=rosette`, `pr=barleycorn` and `pr=certificate`, none of which have
// existed since TASK 9, and decode() silently ignores an unknown `pr`, so four
// samples were quietly rendering identical defaults.
const HERO_IDS = PRESETS.map((p) => p.id);

// A curated subset for the picker: enough range to show the gallery is varied
// without a row of thumbnails wide enough to need its own scroll container.
const PICKER_IDS = ["hammered-copper", "golden-record", "peacock", "silver-star", "tiger"];

// ---------------------------------------------------------------------------

function TopBar() {
  return (
    <header className="topbar">
      <div className="topbar-mark">
        <Typography with="display06">Guilloché</Typography>
        <span className="mono-note">v0.1.0</span>
      </div>
      <nav className="topbar-nav">
        <Link href="https://www.npmjs.com/package/@natebridi/guilloche" with="body01">
          npm
        </Link>
        {/* Icon-only, so the accessible name has to come from aria-label — and
            there is no text for an underline to sit under. */}
        <Link
          href="https://github.com/natebridi/guilloche"
          with="body01"
          aria-label="GitHub"
          underline={false}
        >
          {/* The glyph is the Link's child rather than its `icon` prop: `icon`
              sizes to the label's 1em, which is a thin tap target for the one
              control here that has no text beside it. */}
          <Icon icon="github-logo" size="1.25rem" />
        </Link>
      </nav>
    </header>
  );
}

function Hero() {
  const { index, phase, direction, next, prev } = useSlideCarousel(HERO_IDS.length);
  const preset = findPreset(HERO_IDS[index]);

  return (
    <section className="hero">
      <div className="hero-copy">
        <Typography as="h1" with="display01">
          Guilloché
        </Typography>
        <Typography as="p" with="body02" className="lead">
          The engraved pattern on watch dials and banknotes, rendered live in WebGL2 as
          one custom element.
        </Typography>
        <Link
          href="/create"
          variant="smoke"
          size="lg"
          icon="arrow-right"
          iconPosition="end"
        >
          Create your guilloché
        </Link>
        <span className="mono-note">npm i @natebridi/guilloche</span>
      </div>

      <div className="hero-plate">
        {/* One live element for the whole carousel. `key` is deliberately NOT
            the preset id: re-keying would tear down and rebuild the GL context
            on every slide, which is both the expensive thing and the one thing
            the context budget cannot afford. */}
        <div className={`plate slide slide-${phase} slide-${direction > 0 ? "fwd" : "back"}`}>
          <guilloche-pattern params={paramsString({}, preset?.id)} />
        </div>
        <div className="plate-controls">
          <IconButton icon="caret-left" label="Previous pattern" onClick={prev} />
          <IconButton icon="caret-right" label="Next pattern" onClick={next} />
        </div>
      </div>
    </section>
  );
}

function PresetExample() {
  const [id, setId] = useState(PICKER_IDS[0]);

  return (
    <div className="example example-media-first">
      <div className="plate example-plate">
        <guilloche-pattern params={paramsString({}, id)} />
      </div>
      <div className="example-body">
        <Typography as="h3" with="display04">
          Ready-made presets
        </Typography>
        <div className="picker" role="group" aria-label="Preset">
          {PICKER_IDS.map((presetId) => {
            const active = presetId === id;
            return (
              <button
                key={presetId}
                type="button"
                className="picker-thumb"
                aria-pressed={active}
                onClick={() => setId(presetId)}
              >
                <img src={`/thumbs/${presetId}.webp`} alt={findPreset(presetId)?.title ?? presetId} />
                {/* The active thumb is marked by an overlaid eye rather than a
                    selected-background, so the pattern underneath stays fully
                    visible — the thumbnails are the content here, not labels. */}
                {active && (
                  <span className="picker-eye" aria-hidden="true">
                    <Icon icon="eye" size="1.25rem" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <CodeBlock>{`<guilloche-pattern params="v1&pr=${id}"></guilloche-pattern>`}</CodeBlock>
      </div>
    </div>
  );
}

// Chosen for visible reach rather than for covering the schema: amplitude
// swells the lobes, twist shears them into a spiral, offset opens the hole at
// the centre. All three are floats, so every sweep tweens continuously —
// `density` used to step, because decode() rounds ints.
/** The editor rail's label for a param, so the two never drift apart. */
const paramLabel = (key: string) => SCHEMA.find((d) => d.key === key)?.label ?? key;

const AMP1S = [0.02, 0.06, 0.1];
const TWISTS = [0, 0.9, 2];
const OFFSETS = [0, 0.06, 0.14];

function ParamExample() {
  // All three start OFF their schema default, so the snippet below shows every
  // key from the first paint — `encode` writes only non-default values, and a
  // demo whose code block omits the controls it is demonstrating reads broken.
  const [amp1, setAmp1] = useState(0.1);
  const [twist, setTwist] = useState(0.9);
  const [offset, setOffset] = useState(0.06);

  // The three knobs the controls expose, tweened; everything else is fixed so
  // the demo has a recognisable identity to move around in.
  //
  // These are SCHEMA keys, not url keys: `encode` looks each param up by
  // `d.key` and writes `d.urlKey`, so handing it `mt`/`d`/`tw` matches nothing
  // and silently yields a bare "v1". The url keys only ever appear in the
  // string encode produces — which is exactly what the snippet below shows.
  const tweened = useTweenedParams({ amp1, twist, offset });
  // metal and density are pinned here now that they are no longer controls, so
  // the demo keeps the gold, dense plate it has always had.
  const fixed = { freq1: 24, iridescence: 1, metal: 1, density: 44 };
  const live = paramsString({ ...fixed, ...tweened });
  // The snippet shows where the controls have been set, not where the tween
  // currently is — a code block counting through 43.812 would be noise.
  const shown = paramsString({ ...fixed, amp1, twist, offset });

  return (
    <div className="example">
      <div className="example-body">
        <Typography as="h3" with="display04">
          Build your own
        </Typography>
        <Typography as="p" with="body01" className="lead">
          Every parameter in the guilloché editor can be represented in the embed's
          params property, and any change is immediately rendered.
        </Typography>

        <div className="param-rows">
          <div className="param-row">
            <Typography as="span" with="body01" tone="secondary" className="param-key">
              {paramLabel("amp1")}
            </Typography>
            <ToggleButtonGroup
              aria-label={paramLabel("amp1")}
              value={[String(amp1)]}
              onValueChange={(v) => setAmp1(Number(v[0] ?? amp1))}
            >
              {AMP1S.map((a) => (
                <ToggleButton key={a} size="sm" value={String(a)}>
                  {a.toFixed(2)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </div>
          <div className="param-row">
            <Typography as="span" with="body01" tone="secondary" className="param-key">
              {paramLabel("twist")}
            </Typography>
            <ToggleButtonGroup
              aria-label={paramLabel("twist")}
              value={[String(twist)]}
              onValueChange={(v) => setTwist(Number(v[0] ?? twist))}
            >
              {TWISTS.map((t) => (
                <ToggleButton key={t} size="sm" value={String(t)}>
                  {t.toFixed(1)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </div>
          <div className="param-row">
            <Typography as="span" with="body01" tone="secondary" className="param-key">
              {paramLabel("offset")}
            </Typography>
            <ToggleButtonGroup
              aria-label={paramLabel("offset")}
              value={[String(offset)]}
              onValueChange={(v) => setOffset(Number(v[0] ?? offset))}
            >
              {OFFSETS.map((o) => (
                <ToggleButton key={o} size="sm" value={String(o)}>
                  {o.toFixed(2)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </div>
        </div>

        <CodeBlock>{`params="${shown}"`}</CodeBlock>
      </div>
      <div className="plate example-plate">
        <guilloche-pattern params={live} />
      </div>
    </div>
  );
}

const SHAPES = [
  { id: "full", label: "Full width", css: "aspect-ratio: 16 / 5; width: 100%;" },
  { id: "card", label: "Card", css: "aspect-ratio: 22 / 14; width: 460px;" },
  { id: "circle", label: "Circle", css: "aspect-ratio: 1; width: 340px; border-radius: 50%;" },
];

function ShapeExample() {
  const [shape, setShape] = useState("full");
  const current = SHAPES.find((s) => s.id === shape) ?? SHAPES[0];

  return (
    <div className="example example-stacked">
      <div className="example-head">
        <Typography as="h3" with="display04">
          Any size and shape
        </Typography>
        <Typography as="p" with="body01" className="lead">
          Guilloché can be sized to fit any shape.
        </Typography>
      </div>

      <div className="shape-row">
        <ToggleButtonGroup
          aria-label="Shape"
          value={[shape]}
          onValueChange={(v) => setShape(v[0] ?? shape)}
        >
          {SHAPES.map((s) => (
            <ToggleButton key={s.id} size="sm" value={s.id}>
              {s.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <CodeBlock>{`guilloche-pattern { ${current.css} }`}</CodeBlock>
      </div>

      {/* Fixed height, so switching shape resizes the pattern inside a stable
          box instead of reflowing everything below it.
          The shape class goes on a WRAPPER, not on the element: React renders
          `className` on a custom element as a literal `classname` attribute,
          so styling one directly from JSX silently does nothing. */}
      <div className="shape-stage">
        <div className={`shape shape-${shape}`}>
          <guilloche-pattern params="v1&pr=woodgrain" />
        </div>
      </div>
    </div>
  );
}

const ATTRIBUTES = [
  {
    name: "params",
    fallback: "required",
    description:
      "The editor share-link string. Reactive — change it and the pattern updates in place. Anything you leave out falls back to its default.",
  },
  {
    name: "interactive",
    fallback: "track",
    description:
      "track — the pointer aims the key light from anywhere on the page. hover — only over the element. off — no listeners. gyro — adds device orientation, needs HTTPS.",
  },
  {
    name: "max-dpr",
    fallback: "2",
    description:
      "Cap on devicePixelRatio. Lower it for large embeds — the shader is expensive per pixel.",
  },
];

function Reference() {
  return (
    <section className="section reference" id="reference">
      <Typography as="h2" with="display03">
        Attributes
      </Typography>

      <dl className="attrs">
        {ATTRIBUTES.map((attr) => (
          <div className="attr" key={attr.name}>
            <dt className="attr-name">{attr.name}</dt>
            <dd className="attr-desc">
              {/* Typography's `as` does not accept `dd`, so the preset is
                  applied inside the definition rather than by replacing it —
                  the list keeps its dl/dt/dd semantics either way. */}
              <Typography as="span" with="body01">
                {attr.description}
              </Typography>
            </dd>
            <dd className="attr-default">{attr.fallback}</dd>
          </div>
        ))}
      </dl>

      <div className="code-pair">
        <div className="code-col">
          <Typography as="h3" with="display05">
            Fallback
          </Typography>
          <Typography as="p" with="body01" className="lead">
            Child content shows only when a WebGL2 context can't be created. Put a
            poster image there.
          </Typography>
          <CodeBlock label="html">{`<guilloche-pattern params="v1&pr=peacock">
  <img src="poster.png" alt="Guilloché pattern" />
</guilloche-pattern>`}</CodeBlock>
        </div>
        <div className="code-col">
          <Typography as="h3" with="display05">
            Programmatic
          </Typography>
          <Typography as="p" with="body01" className="lead">
            Drive a canvas directly, without the custom element.
          </Typography>
          <CodeBlock label="js">{`const handle = mountGuilloche(canvas, {
  params: decode("v1&pr=sunburst").params,
});

handle.setParams({ twist: 1.2 });
handle.destroy();`}</CodeBlock>
        </div>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="closing">
      <div className="closing-bg">
        <guilloche-pattern params="v1&pr=black-card" interactive="off" />
      </div>
      <Link href="/create" variant="smoke" size="lg" icon="arrow-right" iconPosition="end">
        Create your guilloché
      </Link>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="topbar-mark">
        <Typography with="display06">Guilloché</Typography>
        <span className="mono-note">MIT · @natebridi/guilloche</span>
      </div>
      <Typography as="span" with="caption02" tone="muted" className="footer-by">
        Built by Nate Bridi
      </Typography>
    </footer>
  );
}

export function Landing() {
  return (
    <>
      <TopBar />
      <main>
        <Hero />
        <section className="section usage">
          <div className="section-head">
            <Typography as="h2" with="display03">
              Usage
            </Typography>
            <Typography as="p" with="body02" className="lead">
              Guilloché configurations can be exported from the editor, either as a
              link or an embed code.
            </Typography>
          </div>
          <PresetExample />
          <ParamExample />
          <ShapeExample />
        </section>
        <Reference />
        <ClosingCta />
      </main>
      <Footer />
    </>
  );
}
