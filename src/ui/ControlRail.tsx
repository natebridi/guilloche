import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ToggleButton, ToggleButtonGroup, Typography } from "@jig-ui/react";
import { SCHEMA, GROUP_SHOW_WHEN, groupsInOrder } from "../schema";
import { PRESETS, findPreset, type Preset } from "../presets";
import { ParamRow } from "./ParamRow";

interface ControlRailProps {
  params: Record<string, number>;
  activePreset: string | null;
  onChange: (key: string, value: number) => void;
  onPreset: (preset: Preset) => void;
  onRandomize: () => void;
  onReset: () => void;
  onCopyLink: () => Promise<void> | void;
  onCopyEmbed: () => Promise<void> | void;
}

export function ControlRail({
  params,
  activePreset,
  onChange,
  onPreset,
  onRandomize,
  onReset,
  onCopyLink,
  onCopyEmbed,
}: ControlRailProps) {
  // Copying is silent otherwise, which reads as a dead button.
  const [copied, setCopied] = useState<"link" | "embed" | "error" | null>(null);
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

  return (
    <aside className="rail">
      <div className="rail-scroll">
        <section className="group preset-bar">
          <h2 className="group-heading">Presets</h2>
          <ToggleButtonGroup
            className="pill-row"
            aria-label="Presets"
            value={activePreset ? [activePreset] : []}
            // Clicking the lit pill would otherwise clear the group; there is
            // no "no preset" the user can pick, so it re-applies instead —
            // which is also how you get back to a preset after editing it.
            onValueChange={(ids) => {
              const preset = findPreset(ids[0] ?? activePreset ?? "");
              if (preset) onPreset(preset);
            }}
          >
            {PRESETS.map((preset) => (
              <ToggleButton key={preset.id} size="sm" value={preset.id}>
                {preset.title}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
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
            <p className="share-note" role="status">
              Clipboard blocked — the URL bar has the link.
            </p>
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

      <footer className="rail-footer">
        <Button size="sm" variant="secondary" onClick={onRandomize}>
          Randomize
        </Button>
        <Button size="sm" variant="ghost" onClick={onReset}>
          Reset
        </Button>
      </footer>
    </aside>
  );
}
