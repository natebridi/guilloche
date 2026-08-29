import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Dialog, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@jig-ui/react";
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
}

// How many preset pills the rail itself shows. The rest live behind "View
// all" — nine pills wrapped to four rows and pushed every control below the
// fold before you had touched anything.
const RAIL_PRESETS = 3;

export function ControlRail({
  params,
  activePreset,
  onChange,
  onPreset,
  onCopyLink,
  onCopyEmbed,
}: ControlRailProps) {
  // Copying is silent otherwise, which reads as a dead button.
  const [copied, setCopied] = useState<"link" | "embed" | "error" | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const runCopy = useCallback(
    async (which: "link" | "embed", fn: () => Promise<void> | void) => {
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

  const railPresets = PRESETS.slice(0, RAIL_PRESETS);
  const railPressed = railPresets.some((p) => p.id === activePreset) ? activePreset : null;

  return (
    <aside className="rail">
      <div className="rail-scroll">
        <section className="group preset-bar">
          <Typography as="h2" with="display06">Presets</Typography>
          <Stack direction="column" spacing="300" align="start">
            <ToggleButtonGroup
              className="pill-row"
              aria-label="Presets"
              // Only claim a value the group actually contains. When the active
              // preset is one of the six behind "View all", the rail's group
              // holds no matching button and must report an empty selection
              // rather than a value none of its children answers to.
              value={railPressed ? [railPressed] : []}
              // Clicking the lit pill would otherwise clear the group; there is
              // no "no preset" the user can pick, so it re-applies instead —
              // which is also how you get back to a preset after editing it.
              onValueChange={(ids) => {
                const preset = findPreset(ids[0] ?? railPressed ?? "");
                if (preset) onPreset(preset);
              }}
            >
              {railPresets.map((preset) => (
                <ToggleButton key={preset.id} size="sm" value={preset.id}>
                  {preset.title}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            {/* Jig's Dialog composes the open handler onto whatever `trigger`
                is, and its body is already wrapped in a ScrollArea — so the
                whole gallery needs no styling of its own here. Open state is
                controlled only because picking a preset has to close it. */}
            <Dialog
              open={galleryOpen}
              onOpenChange={setGalleryOpen}
              size="sm"
              title="Presets"
              description="Pick one to load it. Everything you have not changed resets to its default."
              trigger={
                <Button size="sm" variant="ghost">
                  View all
                </Button>
              }
            >
              <Stack direction="column" spacing="200" align="stretch">
                {PRESETS.map((preset) => (
                  <Button
                    key={preset.id}
                    size="md"
                    variant={preset.id === activePreset ? "primary" : "ghost"}
                    onClick={() => {
                      onPreset(preset);
                      setGalleryOpen(false);
                    }}
                  >
                    {preset.title}
                  </Button>
                ))}
              </Stack>
            </Dialog>
          </Stack>
          <div className="share-row">
            <Button
              size="sm"
              variant="primary"
              icon="copy"
              onClick={() => runCopy("link", onCopyLink)}
            >
              {copied === "link" ? "Copied" : "Copy link"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon="copy"
              title="HTML snippet for embedding this pattern on another page"
              onClick={() => runCopy("embed", onCopyEmbed)}
            >
              {copied === "embed" ? "Copied" : "Copy embed"}
            </Button>
          </div>
          {copied === "error" && (
            <Typography as="p" with="caption01" role="status" className="share-note">
              Clipboard blocked — the URL bar has the link.
            </Typography>
          )}
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
