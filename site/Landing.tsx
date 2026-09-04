import { useRef, useState } from "react";
import {
  Box,
  CodeBlock,
  Grid,
  Icon,
  IconButton,
  Link,
  Separator,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@jig-ui/react";
import '@jig-ui/react/styles.css';                    // required
import { findPreset } from "../src/presets";
import { HERO_SETS, layerParams, layerStyle } from "./heroSets";
import { SCHEMA } from "../src/schema";
import type { GuillochePatternElement } from "../src/element";
import {
  paramsString,
  usePhaseCarousel,
  usePlateTone,
  useSharedLight,
  useTweenedParams,
} from "./patternDemo";

/**
 * The page gutter, as a Jig responsive spacing value.
 *
 * This is what the old `--gutter` custom property did, expressed on Jig's own
 * scale and breakpoints rather than as a hand-rolled variable plus a media
 * query. Every full-width band spreads it, so the top bar, the sections and the
 * footer cannot drift apart.
 */
const GUTTER = { xs: "500", lg: "800" } as const;

/**
 * The shape of a two-column example row, and the point at which it folds to one.
 *
 * Jig's breakpoints are 480/768/1024/1280; the page's old hand-rolled one was
 * 860, which is none of them. Folding at `lg` keeps a single set of breakpoints
 * on the page, and it suits the content — a 32rem plate beside a column of copy
 * wants more than 860px to read as a row.
 */
const ROW = { xs: "column", lg: "row" } as const;
const ROW_ALIGN = { xs: "stretch", lg: "center" } as const;
const ROW_SPACING = { xs: "500", lg: "700" } as const;

// A curated subset for the picker: enough range to show the gallery is varied
// without a row of thumbnails wide enough to need its own scroll container.
const PICKER_IDS = ["hammered-copper", "golden-record", "cornfield", "silver-star", "tiger"];

// ---------------------------------------------------------------------------

function TopBar() {
  return (
    <Stack
      as="header"
      className="topbar"
      direction="row"
      align="center"
      justify="between"
      spacing="500"
      px={GUTTER}
      py="500"
    >
      <Stack direction="row" align="baseline" spacing="400">
        <Typography with="display06">Guilloché</Typography>
        <span className="mono-note">v0.1.0</span>
      </Stack>
      <Stack as="nav" direction="row" align="center" spacing="600">
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
      </Stack>
    </Stack>
  );
}

function Hero() {
  const { index, phase, next, prev } = usePhaseCarousel(HERO_SETS.length);
  const set = HERO_SETS[index];
  // The bottom layer carries the tone. Upper layers sit over it, so their own
  // average is not what the overlay is sitting on.
  const baseRef = useRef<GuillochePatternElement | null>(null);
  const base = layerParams(set.layers[0]);
  const tone = usePlateTone(baseRef, base);
  // Every layer is lit from the bottom layer's lamp, so a stack reads as one
  // room. Their patterns stay independent — pan, centre and scale are still
  // per layer, so sets can be arranged freely.
  const stackRef = useRef<HTMLDivElement | null>(null);
  useSharedLight(stackRef, set.id);

  return (
    <Stack
      as="section"
      align="center"
      spacing="500"
      px={GUTTER}
      py={{ xs: "600", lg: "700" }}
      style={{ maxWidth: '70rem', marginInline: 'auto' }}
    >
      <div className="plate-frame">
        <div ref={stackRef} className={`plate focus focus-${phase}`}>
          {/* Keyed by POSITION, never by set id. A key carrying the set id
              re-keys every layer on every step, which tears down each WebGL
              context and builds a new one — the expensive thing, and the one
              the per-page context cap cannot afford. Keyed by index, layer 0
              is the same element across sets and merely changes its `params`;
              only a set with a different LAYER COUNT mounts or unmounts one. */}
          {set.layers.map((layer, i) => (
            <div className="plate-layer" key={i} style={layerStyle(layer)}>
              <guilloche-pattern
                ref={i === 0 ? baseRef : undefined}
                params={i === 0 ? base : layerParams(layer)}
              />
            </div>
          ))}
        </div>

        <Typography
          as="h1"
          with="display01"
          className="hero-title"
          style={{ color: tone?.ink }}
        >
          Guilloché
        </Typography>

        <Box
          className="hero-blurb"
          px="500"
          py="400"
          style={{ backgroundColor: `rgb(from ${tone?.css} r g b / 0.5)`, color: tone?.inkBody }}
        >
          <Typography as="p" with="display06" style={{ color: tone?.inkBody }}>
            Mesmerizing engraved patterns, available as a fully-customizable shader.
          </Typography>
        </Box>
      </div>

      <Stack direction="row" justify="center" spacing="200">
        <IconButton icon="caret-left" size="lg" label="Previous pattern" onClick={prev} />
        <IconButton icon="caret-right" size="lg" label="Next pattern" onClick={next} />
      </Stack>

      <Stack className="wrap" direction="row" align="baseline" justify="center" spacing="300">
        <Typography as="span" with="body01" tone="secondary">
          Install package:
        </Typography>
        <span className="mono-note">npm i @natebridi/guilloche</span>
      </Stack>

      <svg width="0" height="0">
        <filter id="lg">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="noise" />
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.5 0" in="noise" result="softNoise" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blurred" />
          <feDisplacementMap in="blurred" in2="softNoise" scale="20" xChannelSelector="R" yChannelSelector="G" result="refracted" />
          <feSpecularLighting in="softNoise" surfaceScale="5" specularConstant="0.25" specularExponent="60" lighting-color="#ffffff" result="light">
            <fePointLight x="-5000" y="-10000" z="20000" />
          </feSpecularLighting>
          <feComposite in="light" in2="refracted" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
        </filter>
      </svg>
    </Stack>
  );
}

function PresetExample() {
  const [id, setId] = useState(PICKER_IDS[0]);

  return (
    <Stack direction={ROW} align={ROW_ALIGN} spacing={ROW_SPACING}>
      <div className="plate example-plate">
        <guilloche-pattern params={paramsString({}, id)} />
      </div>
      <Stack className="min-w-0" spacing="500" align="start" grow>
        <Typography as="h3" with="display04">
          Ready-made presets
        </Typography>
        {/* Five across, which is not a count Jig's Grid can take — `columns`
            accepts only the divisors of 24 — so this one stays hand-rolled. */}
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
      </Stack>
    </Stack>
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
    <Stack direction={ROW} align={ROW_ALIGN} spacing={ROW_SPACING}>
      <Stack className="min-w-0" spacing="500" align="start" grow>
        <Typography as="h3" with="display04">
          Build your own
        </Typography>
        <Typography as="p" with="body01" className="lead">
          Every parameter in the guilloché editor can be represented in the embed's
          params property, and any change is immediately rendered.
        </Typography>

        <Stack spacing="300">
          <Stack direction="row" align="center" spacing="500">
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
          </Stack>
          <Stack direction="row" align="center" spacing="500">
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
          </Stack>
          <Stack direction="row" align="center" spacing="500">
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
          </Stack>
        </Stack>

        <CodeBlock>{`params="${shown}"`}</CodeBlock>
      </Stack>
      <div className="plate example-plate">
        <guilloche-pattern params={live} />
      </div>
    </Stack>
  );
}

const SHAPES = [
  { id: "full", label: "Full width", css: "aspect-ratio: 16 / 5; width: 100%;" },
  { id: "card", label: "Card", css: "aspect-ratio: 22 / 14; width: 460px;" },
  { id: "circle", label: "Circle", css: "aspect-ratio: 1; width: 340px; border-radius: 50%;" },
];


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
    <Stack
      as="section"
      className="reference"
      id="reference"
      spacing="700"
      px={GUTTER}
      pt="700"
      pb="800"
      style={{ maxWidth: '60rem', marginInline: 'auto' }}
    >
      <Typography as="h2" with="display03">
        Attributes
      </Typography>

      {/* Stays a hand-rolled grid: Grid places `Box` children, and Box will not
          render as `dt`/`dd`, so adopting it here would cost the list its
          dl/dt/dd semantics. */}
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

      <Grid columns={{ xs: 1, lg: 2 }} spacing="600">
        <Stack className="min-w-0" spacing="400">
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
        </Stack>
        <Stack className="min-w-0" spacing="400">
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
        </Stack>
      </Grid>
    </Stack>
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
    <Stack
      as="footer"
      className="footer wrap"
      direction="row"
      align="center"
      justify="between"
      spacing="500"
      px={GUTTER}
      py="500"
    >
      <Stack direction="row" align="baseline" spacing="400">
        <Typography with="display06">Guilloché</Typography>
        <span className="mono-note">MIT · @natebridi/guilloche</span>
      </Stack>
      <Typography as="span" with="caption02" tone="muted">
        Built by Nate Bridi
      </Typography>
    </Stack>
  );
}

export function Landing() {
  return (
    <>
      <TopBar />
      <Separator />
      <main>
        <Hero />
        <Stack as="section" spacing="700" px={GUTTER} pt="700" pb="800" style={{ maxWidth: '60rem', marginInline: 'auto' }}>
          <Stack spacing="400">
            <Typography as="h2" with="display03">
              Usage
            </Typography>
            <Typography as="p" with="body02" className="lead">
              Guilloché configurations can be exported from the editor, either as a
              link or an embed code.
            </Typography>
          </Stack>
          <PresetExample />
          <ParamExample />
        </Stack>
        <Separator />
        <Reference />
        <ClosingCta />
      </main>
      <Separator />
      <Footer />
    </>
  );
}
