import { useRef, useState } from "react";
import {
  Adorn,
  CodeBlock,
  Collapsible,
  Grid,
  Icon,
  IconButton,
  Link,
  Separator,
  Stack,
  StructuredList,
  StructuredListCell,
  StructuredListRow,
  Typography,
} from "@jig-ui/react";
import { color, radius } from "@jig-ui/react/tokens";
import '@jig-ui/react/styles.css';                    // required
import { findPreset, presetParams } from "../src/presets";
import { HERO_SETS, layerParams, layerStyle } from "./heroSets";
import { SCHEMA, type ParamDef } from "../src/schema";
import {
  groupsInOrder,
  metaOf,
  type Display,
} from "../src/paramMeta";
// Shared with the editor rather than reimplemented: units.ts is Jig-free and
// is the single place the display-unit rules live, so the panel cannot drift
// from what the rail shows for the same param.
import { displayOf, formatDisplay } from "../src/ui/units";
import type { GuillochePatternElement } from "../src/element";
import {
  paramsString,
  usePhaseCarousel,
  usePlateTone,
  useCardTilt,
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
        <Typography with="code01"><Adorn with="muted">v0.1.0</Adorn></Typography>
      </Stack>
      <Stack as="nav" direction="row" align="center" spacing="600">
        <Link href="https://www.npmjs.com/package/@n8bridi/guilloche" with="body01">
          npm
        </Link>
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

        <Stack
          className="hero-blurb"
          direction="row"
          spacing="500"
          px="500"
          py="400"
          style={{ backgroundColor: `${tone?.css}` }}
        >
          <IconButton icon="caret-left" size="lg" label="Previous pattern" variant="smoke" onClick={prev} />
          <Link variant="primary" href="/create" size="lg">Start building</Link>
          <IconButton icon="caret-right" size="lg" label="Next pattern" variant="smoke" onClick={next} />
        </Stack>
      </div>

      <Stack direction="row" justify="center">
          <Typography as="p" with="display05" style={{ color: tone?.inkBody, textAlign: 'center' }} balance>
            Mesmerizing engraved patterns, available as a fully-customizable shader.
          </Typography>
      </Stack>

      <Stack className="wrap" direction="row" align="baseline" justify="center" spacing="300">
        <Typography as="span" with="body02" tone="secondary">
          Install package:
        </Typography>
        <Adorn with="mono">npm i @n8bridi/guilloche</Adorn>
      </Stack>

    </Stack>
  );
}

/**
 * The parameters the preview panel shows.
 *
 * Six, chosen because they differ across every preset in the picker — a row
 * that reads the same value for all five would just sit there while the others
 * animate. Order matches the editor's rail (Layout, then Layers, then Rosette,
 * then Spiral) so the panel reads as a simplification of it rather than a
 * different arrangement of the same facts.
 */
const PANEL_KEYS = ["density", "cutWidth", "passes", "amp1", "freq1", "twist"];

const PANEL_DEFS = PANEL_KEYS.map((key) => {
  const def = SCHEMA.find((d) => d.key === key);
  if (!def) throw new Error(`Unknown panel param: ${key}`);
  return { def, display: displayOf(def) };
});

/**
 * One non-functional param row: the editor's label / track / readout, with the
 * control taken out.
 *
 * The track is `aria-hidden` because it is a picture of a slider rather than
 * one — but the label and value are left readable, since they are the actual
 * information. Rendering a real Slider here would be worse than useless: it
 * would take focus and invite a drag that does nothing.
 */
function PanelRow({ def, display, value }: { def: ParamDef; display: Display; value: number }) {
  const shown = display.toDisplay(value);
  const fill = (shown - display.min) / Math.max(display.max - display.min, 1e-6);
  const pct = `${(Math.min(Math.max(fill, 0), 1) * 100).toFixed(2)}%`;
  return (
    <div className="panel-row">
      <Typography as="span" with="caption02" className="panel-label">
        {metaOf(def.key).label}
      </Typography>
      <span className="panel-track" aria-hidden="true">
        <span className="panel-fill" style={{ width: pct }} />
      </span>
      <Adorn className="panel-value" with="mono">
        {formatDisplay(display, shown)}
        <Adorn with="muted">{display.unit}</Adorn>
      </Adorn>
    </div>
  );
}

function EditorPreview() {
  const [id, setId] = useState(PICKER_IDS[0]);
  const cardRef = useRef<HTMLDivElement | null>(null);
  useCardTilt(cardRef);

  const preset = findPreset(id);
  // Expanded to defaults-plus-values, so a param the preset does not set still
  // has the value the editor would show for it rather than going undefined.
  const target = preset ? presetParams(preset) : {};
  // Tweened in RAW units and converted per frame, so the readout counts and the
  // track slides. Ints still step, because their display rounds — the same
  // honest behaviour the old density control had.
  const tweened = useTweenedParams(
    Object.fromEntries(PANEL_KEYS.map((k) => [k, target[k] ?? 0])),
  );

  return (
    <Stack direction={ROW} align={ROW_ALIGN} spacing={{ xs: "500", lg: "600" }} py="500" pl="600" pr="500" style={{ backgroundColor: color.surfaces.card, borderRadius: radius[600] }}>
      {/* The card tilts toward the pointer exactly as the editor's stage does,
          and the SAME pointer is aiming the key light inside it. */}
      <div className="demo-card" ref={cardRef}>
        <guilloche-pattern params={paramsString({}, id)} />
      </div>

      <Separator orientation="vertical" />

      <Stack className="min-w-0" spacing="500" align="start" grow>

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

        <div className="panel">
          {PANEL_DEFS.map(({ def, display }) => (
            <PanelRow
              key={def.key}
              def={def}
              display={display}
              value={tweened[def.key] ?? 0}
            />
          ))}
          <Link
            href={`/create?${paramsString({}, id)}`}
            variant="secondary"
            icon="arrow-right"
            iconPosition="end"
            style={{ marginTop: 'var(--spacing-400)'}}
          >
            Open in editor
          </Link>
        </div>

      </Stack>
    </Stack>
  );
}

const ATTRIBUTES = [
  {
    name: "params",
    fallback: "required",
    description:
      "Params string exported from the editor. Reactive updates when value is changed."
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
      "Cap on devicePixelRatio. Can be lowered if shader performance suffers.",
  },
];

/**
 * The parameter reference, split across the two columns of the Grid.
 *
 * Both the split and the group order come from `groupsInOrder()`, so a new
 * group in SCHEMA appears here on its own. The break is chosen to balance row
 * counts rather than group counts — Material alone is 13 rows, so an even
 * split of the NINE groups would leave one column half the height of the other.
 */
const PARAM_COLUMNS: string[][] = (() => {
  const groups = groupsInOrder();
  const count = (g: string) => SCHEMA.filter((d) => metaOf(d.key).group === g).length;
  const total = SCHEMA.length;
  const left: string[] = [];
  let filled = 0;
  for (const g of groups) {
    // Take groups until the next one would push this column past half.
    if (filled > 0 && filled + count(g) > total / 2) break;
    left.push(g);
    filled += count(g);
  }
  return [left, groups.filter((g) => !left.includes(g))];
})();

/**
 * One group's parameters.
 *
 * Both key spellings are shown because they address two different interfaces
 * and are NOT interchangeable: `Param` is the schema key, which is what
 * `setParams({ amp1: 0.05 })` and the copied JS object take, while `URL` is the
 * short key that goes inside `params="v1&a1=0.05"`. Putting a schema key in a
 * params string is silently ignored — `encode` looks each param up by `key` and
 * writes `urlKey` — so showing only one of them would send half the readers
 * down a dead end.
 *
 * Everything but the prose is read from SCHEMA: both keys, the default, and an
 * enum's option names. Only the descriptions are authored, in paramDocs.ts.
 */
function ParamGroup({ group }: { group: string }) {
  const defs = SCHEMA.filter((d) => metaOf(d.key).group === group);
  return (
    // hiddenUntilFound rather than the default (fully unmounted): this is a
    // reference page, so a reader's find-in-page search should still be able
    // to land inside a group they haven't opened.
    <Collapsible label={group} with="heading05" hiddenUntilFound>
      <StructuredList
        headers={["Param", "What it does", "Default", "URL"]}
        columnWidths={["7rem", "auto", "4rem", "2.75rem"]}
        layout={{ xs: "stacked", lg: "columns" }}
        with="body01"
      >
        {defs.map((def) => (
          <StructuredListRow key={def.key}>
            {/* The three narrow columns drop to caption02: at body01 the
                longest schema key (twistWavePhase) needs most of 8rem, which is
                width the description cannot spare in a two-up grid. */}
            <StructuredListCell with="caption02">
              <Adorn as="code" with="mono">{def.key}</Adorn>
            </StructuredListCell>
            <StructuredListCell with="caption02">
              {metaOf(def.key).description}
              {/* Enum option names come from SCHEMA rather than being written
                  into the prose, so renaming an option cannot leave the docs
                  describing one that no longer exists. */}
              {metaOf(def.key).options ? (
                <>
                  {" "}
                  <Adorn with="muted">
                    {metaOf(def.key)
                      .options!.map((o, i) => `${i} = ${o}`)
                      .join(", ")}
                    .
                  </Adorn>
                </>
              ) : null}
            </StructuredListCell>
            <StructuredListCell with="caption02">
              <Adorn with="mono">
                <Adorn with="muted">{def.default}</Adorn>
              </Adorn>
            </StructuredListCell>
            {/* Muted against the plain Param column: the two are not
                interchangeable, and this is the secondary of the pair. */}
            <StructuredListCell with="caption02">
              <Adorn as="code" with="mono">
                <Adorn with="muted">{def.urlKey}</Adorn>
              </Adorn>
            </StructuredListCell>
          </StructuredListRow>
        ))}
      </StructuredList>
    </Collapsible>
  );
}

function Reference() {
  return (
    <Stack
      as="section"
      className="reference"
      id="reference"
      spacing="500"
      px={GUTTER}
      pt="700"
      pb="800"
      style={{ maxWidth: '60rem', marginInline: 'auto' }}
    >
      <Typography as="h2" with="display05">
        Using &lt;guilloche-pattern&gt;
      </Typography>

      {/* Jig's StructuredList, which is a better fit than the dl/dt/dd this
          replaced: it carries proper ARIA table roles for what is genuinely a
          three-column table (a dl with two dds per dt was always a stretch),
          it draws its own row rules, and it stacks on a narrow screen — which
          is what the hand-rolled `.attr` grid and its media query were for.
          `columnWidths` reproduces the old 11rem / 1fr / 6rem template. */}
      <StructuredList
        headers={["Attribute", "What it does", "Default"]}
        columnWidths={["11rem", "auto", "6rem"]}
        layout={{ xs: "stacked", lg: "columns" }}
        with="body01"
      >
        {ATTRIBUTES.map((attr) => (
          <StructuredListRow key={attr.name}>
            {/* Nested Adorn is the documented way to get family and colour
                separately — the outer sets monospace, the inner the tint. It
                is what ParamRow already does for the editor's readouts. */}
            <StructuredListCell with="code01">{attr.name}</StructuredListCell>
            <StructuredListCell>{attr.description}</StructuredListCell>
            <StructuredListCell with="code01">
                <Adorn with="muted">{attr.fallback}</Adorn>
            </StructuredListCell>
          </StructuredListRow>
        ))}
      </StructuredList>

      <Typography as="h2" with="display05" mt="600">
        Parameter reference
      </Typography>

      <Stack direction={{ xs: 'column', lg: 'row' }} style={{ width: 'stretch' }} spacing="600" alignSelf="stretch" align="stretch">
        {PARAM_COLUMNS.map((groups, i) => (<>
          <Stack key={i} style={{ width: 'stretch' }} spacing="600">
            {groups.map((group) => (
              <ParamGroup key={group} group={group} />
            ))}
          </Stack>
          {i == 0 && <Separator orientation="vertical" /> }
        </>))}
      </Stack>

      <Grid columns={{ xs: 1, lg: 2 }} spacing="600" mt="600">
        <Stack spacing="400">
          <Typography as="h3" with="display05">
            Fallback
          </Typography>
          <Typography as="p" with="body01" className="lead">
            Child content displays when WebGL2 isn't available.
          </Typography>
          <CodeBlock label="html">{`<guilloche-pattern params="v1&pr=peacock">
  <img src="fallback.png" alt="Guilloché pattern" />
</guilloche-pattern>`}</CodeBlock>
        </Stack>
        <Stack spacing="400">
          <Typography as="h3" with="display05">
            Programmatic
          </Typography>
          <Typography as="p" with="body01" className="lead">
            Skip the custom element and display to canvas directly.
          </Typography>
          <CodeBlock label="js" style={{ width: 'stretch' }}>{`const yourGuilloche = mountGuilloche(canvas, {
  params: decode("v1&pr=sunburst").params,
});

yourGuilloche.setParams({ twist: 1.2 });
yourGuilloche.destroy();`}</CodeBlock>
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
        <Typography with="code01"><Adorn with="muted">@n8bridi/guilloche</Adorn></Typography>
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
              Build your guilloché
            </Typography>
            <Typography as="p" with="body02" className="lead">
              Guilloché patterns are built and exported from the editor, where you can adjust every aspect of the style and display
            </Typography>
          </Stack>
          <EditorPreview />
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
