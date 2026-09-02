import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Dialog, Icon, Separator, Typography } from "@jig-ui/react";
import { SCHEMA, GROUP_SHOW_WHEN, groupsInOrder } from "../schema";
import { PRESETS, findPreset, type Preset } from "../presets";
import { ParamRow } from "./ParamRow";

interface ControlRailProps {
  params: Record<string, number>;
  activePreset: string | null;
  onChange: (key: string, value: number) => void;
  onPreset: (preset: Preset) => void;
  onCopyLink: () => Promise<void> | void;
  onCopyEmbed: () => Promise<void> | void;
  onCopyJs: () => Promise<void> | void;
}

/** What the three share buttons copy. */
type CopyKind = "link" | "embed" | "js";

// How many thumbnails the strip shows before the overflow button. Four plus
// the button is exactly what 320px holds without wrapping; the rest live
// behind the gallery. Thumbnails rather than name pills because the names are
// what broke the old layout — "Hammered Copper" is three times the width of
// "Peacock", so a wrapping row of them could never come out even.
const RAIL_PRESETS = 4;

export function ControlRail({
  params,
  activePreset,
  onChange,
  onPreset,
  onCopyLink,
  onCopyEmbed,
  onCopyJs,
}: ControlRailProps) {
  // Copying is silent otherwise, which reads as a dead button.
  const [copied, setCopied] = useState<CopyKind | "error" | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const runCopy = useCallback(
    async (which: CopyKind, fn: () => Promise<void> | void) => {
      try {
        await fn();
        setCopied(which);
      } catch {
        // Clipboard access can be denied (insecure origin, permissions).
        setCopied("error");
      }
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(null), 1600);
    },
    [],
  );

  // The strip is now the only indicator of which preset is loaded, so the
  // active one has to be IN it. If it lives behind the gallery, it takes the
  // last slot rather than being invisible.
  const railPresets = (() => {
    const head = PRESETS.slice(0, RAIL_PRESETS);
    if (!activePreset || head.some((p) => p.id === activePreset)) return head;
    const active = findPreset(activePreset);
    return active ? [...head.slice(0, RAIL_PRESETS - 1), active] : head;
  })();
  const activeTitle = findPreset(activePreset)?.title ?? "Custom";

  return (
    <aside className="rail">
      {/* Persistent header, OUTSIDE the scrolling body. Export is not a preset
          concern; sitting inside that section was the whole reason the two
          read as one confused block. One verb, three destinations — the icon
          and the word carry the action so each button is a single noun. */}
      <div className="rail-header">
        <div className="share-row">
          <span className="share-label">
            <Icon icon="copy" />
            <Typography as="span" with="caption02" tone="secondary">
              Copy
            </Typography>
          </span>
          <div className="share-actions">
            <Button
              size="sm"
              variant="secondary"
              title="Shareable URL for this pattern"
              onClick={() => runCopy("link", onCopyLink)}
            >
              {copied === "link" ? "Copied" : "Link"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              title="HTML snippet for embedding this pattern on another page"
              onClick={() => runCopy("embed", onCopyEmbed)}
            >
              {copied === "embed" ? "Copied" : "Embed"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              title="The params as a JS object, for driving the engine directly"
              onClick={() => runCopy("js", onCopyJs)}
            >
              {copied === "js" ? "Copied" : "JS"}
            </Button>
          </div>
        </div>
        {copied === "error" && (
          <Typography as="p" with="caption01" role="status" className="share-note">
            Clipboard blocked — the URL bar has the link.
          </Typography>
        )}
      </div>
      {/* Not `decorative`: the boundary between the export toolbar and the
          controls below is carried by this rule alone — there is no heading on
          the header for a screen reader to hear instead. */}
      <Separator />

      <div className="rail-scroll">
        <section className="group preset-bar">
          <div className="preset-head">
            <Typography as="h2" with="display06">Presets</Typography>
            <Typography as="span" with="caption02" tone="secondary">
              {activeTitle}
            </Typography>
          </div>
          <div className="preset-strip">
            {/* Unlike the gallery's tiles these carry no visible title, so the
                image needs a real alt — it is the button's only name. */}
            {railPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="preset-thumb-btn"
                aria-pressed={preset.id === activePreset}
                title={preset.title}
                onClick={() => onPreset(preset)}
              >
                <img
                  src={`/thumbs/${preset.id}.webp`}
                  alt={preset.title}
                  width={320}
                  height={320}
                  loading="lazy"
                  decoding="async"
                />
              </button>
            ))}

            {/* Jig's Dialog composes the open handler onto whatever `trigger`
                is, and its body is already wrapped in a ScrollArea — so the
                whole gallery needs no styling of its own here. Open state is
                controlled only because picking a preset has to close it. */}
            <Dialog
              open={galleryOpen}
              onOpenChange={setGalleryOpen}
              size="md"
              title="Presets"
              description="Pick one to load it. Everything you have not changed resets to its default."
              trigger={
                <button type="button" className="preset-more" aria-label="All presets">
                  {/* Jig's curated set has no meatball, and Icon takes raw SVG
                      as children for exactly this case — sized and coloured
                      like any built-in glyph. */}
                  <Icon viewBox="0 0 24 24" size="1rem">
                    <circle cx="5" cy="12" r="1.7" fill="currentColor" />
                    <circle cx="12" cy="12" r="1.7" fill="currentColor" />
                    <circle cx="19" cy="12" r="1.7" fill="currentColor" />
                  </Icon>
                </button>
              }
            >
              {/* Hand-rolled rather than Jig Buttons: a labelled image tile is
                  not one of Jig's control primitives, and this is the one place
                  the gallery earns real estate over a list of names.
                  Thumbnails are generated by `npm run thumbs` and served from
                  public/, so a missing one degrades to an empty plate rather
                  than breaking the build. */}
              <div className="preset-grid">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="preset-tile"
                    aria-pressed={preset.id === activePreset}
                    onClick={() => {
                      onPreset(preset);
                      setGalleryOpen(false);
                    }}
                  >
                    {/* alt="" on purpose: the title below is inside the same
                        button, so describing the image again would just make
                        every tile announce itself twice. */}
                    <span className="preset-thumb">
                      <img
                        src={`/thumbs/${preset.id}.webp`}
                        alt=""
                        width={320}
                        height={320}
                        loading="lazy"
                        decoding="async"
                      />
                    </span>
                    <span className="preset-tile-title">{preset.title}</span>
                  </button>
                ))}
              </div>
            </Dialog>
          </div>
        </section>

        {groupsInOrder().map((group) => {
          // Hide folders that don't apply to the current render mode.
          const showWhen = GROUP_SHOW_WHEN[group];
          if (showWhen !== undefined && Math.round(params.shaded) !== showWhen) {
            return null;
          }
          return (
            <section className="group" key={group}>
              <Typography as="h2" with="display06">{group}</Typography>
              {SCHEMA.filter((d) => d.group === group).map((def) => (
                <ParamRow
                  key={def.key}
                  def={def}
                  value={params[def.key]}
                  onChange={onChange}
                />
              ))}
            </section>
          );
        })}
      </div>
    </aside>
  );
}
