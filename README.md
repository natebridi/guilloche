# guilloche

Procedural guilloché (rose-engine) patterns rendered as a WebGL2 fragment
shader — no geometry, no textures, no rendering library. Ships as a drop-in
custom element and as a small programmatic API.

**~13.6 kB gzipped**, self-contained (shaders are inlined at build time, so
there are no runtime asset fetches).

## Embed on a page

```html
<script type="module"
  src="https://cdn.jsdelivr.net/npm/@natebridi/guilloche@0.1/dist-embed/guilloche-element.js"></script>

<guilloche-pattern params="v1&pr=barleycorn" style="width:480px"></guilloche-pattern>
```

The `params` string is the same one the [editor](#editor)'s **Copy link**
button produces, so a shared link and an embed are interchangeable. The
editor's **Copy embed** button writes the whole snippet above.

### Attributes

| Attribute | Values | Notes |
| --- | --- | --- |
| `params` | share-link string | Reactive — change it and the pattern updates in place. Anything unset falls back to its default. |
| `interactive` | `hover` (default), `off`, `gyro` | `hover` aims the key light while the pointer is over the element. `off` attaches no listeners at all. `gyro` adds device orientation — see below. |
| `max-dpr` | number, default `2` | Cap on `devicePixelRatio`. The shader is expensive per-pixel; lower this for large embeds. |

Sizing is plain CSS — the element defaults to `width: 100%` with a 1:1 aspect
ratio, and you can override either.

### Device orientation (`interactive="gyro"`)

Two browser rules govern this, and both fail *silently* if you trip them:

1. **It requires a secure context.** Over `http://` on a LAN address (e.g.
   `http://192.168.1.20:5173`) device orientation is unavailable — on iOS,
   `DeviceOrientationEvent.requestPermission` isn't even defined there.
   `localhost` counts as secure; a LAN IP over plain HTTP does not. The
   element sets `data-gyro="insecure"` and logs one warning when it detects
   this, since there is otherwise no way to tell.
2. **iOS grants permission only from a real user gesture.** The element
   therefore renders an "Enable motion" button when permission is pending,
   rather than requesting on load or on an ambient tap.

The element reflects its state as `data-gyro` (`unsupported` / `insecure` /
`prompt` / `granted` / `denied`) and fires a bubbling `guilloche:gyro` event on
each change. To supply your own affordance, hide the built-in one and call the
method from your own click handler:

```css
guilloche-pattern::part(gyro-button) { display: none; }
```

```js
myButton.addEventListener("click", () => el.requestGyro());
```

**Testing on a phone:** a LAN dev server won't work. Use an HTTPS tunnel
(`npx localtunnel --port 5183`, or `cloudflared tunnel --url
http://localhost:5183`), or just deploy a preview — `npx vercel` /
`npx netlify deploy` give a real HTTPS URL in about a minute.

### Fallback content

Children render only if a WebGL2 context can't be created:

```html
<guilloche-pattern params="v1&pr=rosette">
  <img src="poster.png" alt="Guilloché pattern" />
</guilloche-pattern>
```

### Events

`guilloche:ready` and `guilloche:error` both bubble; the error event carries
the underlying error in `detail`.

## Install

```sh
npm install @natebridi/guilloche
```

```js
// Register the element yourself:
import { defineGuillocheElement } from "@natebridi/guilloche";
defineGuillocheElement();

// …or import the side-effecting entry:
import "@natebridi/guilloche/element";
```

Both are safe to import under SSR (Next.js, Astro) — registration no-ops
without a `window`.

## Programmatic use

```js
import { mountGuilloche, decode, schemaDefaults } from "@natebridi/guilloche";

const handle = mountGuilloche(canvas, {
  params: { ...schemaDefaults(), ...decode("v1&pr=sunburst").params },
  interactive: true,
});

handle.setParams({ twist: 1.2 }); // live update
handle.setActive(false);          // idle the render loop
handle.destroy();                 // release the GL context
```

`mountGuilloche` throws `WebGL2UnavailableError` if no context is available.

Also exported: `GuillocheEngine` (the raw renderer), `SCHEMA` / `schemaDefaults`
(every parameter's range, type, and default), `PRESETS` / `presetParams`, and
`encode` / `decode` for the URL format.

## Performance notes

- The element allocates its GL context lazily, when it scrolls near the
  viewport, and idles its render loop while off-screen. Browsers cap live
  WebGL contexts per page (roughly 8–16), so this matters on long pages.
- Rendering is dirty-flagged: a static pattern costs nothing after the first
  frame.
- Cost scales with pixels × passes. On large embeds, lower `max-dpr` before
  anything else.

## Browser support

Any browser with WebGL2 — Chrome/Edge 56+, Firefox 51+, Safari 15+. The
package ships ES modules only, which every WebGL2-capable browser supports.

## Editor

The tuning UI is a separate React app in this repo (`npm run dev`). It isn't
part of the published package.

## Development

```sh
npm run dev          # editor at :5183
npm run build        # editor -> dist/
npm run build:embed  # package -> dist-embed/ (+ .d.ts)
npm run build:all    # both
```

`demo/embed.html` is a static page exercising the element against a local
build — run `npm run build:embed` first.

## License

MIT
