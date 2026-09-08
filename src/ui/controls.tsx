import { Slider, ToggleButton, ToggleButtonGroup, Tooltip } from "@jig-ui/react";
import { type ParamDef } from "../schema";
import { metaOf } from "../paramMeta";
import { displayOf } from "./units";

interface ControlProps {
  def: ParamDef;
  value: number;
  onChange: (value: number) => void;
}

// Float slider, and — with `steppers` — the integer stepper too: Jig's Slider
// flanks the track with −/+ buttons, which is exactly the hand-rolled stepper
// it replaced. `label` is Jig's only route to an accessible name (there is no
// aria-label prop), so it is always passed; styles.css lays the label and track
// out on one line to keep the rail compact.
//
// The slider runs entirely in DISPLAY units — a percent slider genuinely has
// 100 stops — and `toRaw` converts (and rounds) on the way back out. Steppers
// stay tied to `def.type`, not to the display step: every percent param has a
// step of 1 as well, and putting ± buttons on 23 more rows would swamp the rail.
export function ParamSlider({ def, value, onChange }: ControlProps) {
  const d = displayOf(def);
  const meta = metaOf(def.key);
  return (
    <Slider
      className="row-slider"
      size="sm"
      // `label` takes a ReactNode, so the tooltip wraps the label TEXT rather
      // than the control — hovering the word explains it, and the slider keeps
      // Jig's real <label> binding and its accessible name.
      label={
        <Tooltip content={meta.description} placement="left" delay={350}>
          <span>{meta.label}</span>
        </Tooltip>
      }
      min={d.min}
      max={d.max}
      step={d.step}
      // Page Up/Down and Shift+Arrow. Jig's default of 10 is in value units,
      // which would overshoot every sub-unit range in the schema.
      largeStep={d.step * 10}
      value={d.toDisplay(value)}
      steppers={def.type === "int"}
      format={{ minimumFractionDigits: d.decimals, maximumFractionDigits: d.decimals }}
      onValueChange={(shown) => onChange(d.toRaw(shown))}
    />
  );
}

// Enum picker. The group's value is an array of strings even in single-select
// mode, so the numeric param index round-trips through String()/Number().
export function ParamSegmented({ def, value, onChange }: ControlProps) {
  const current = String(Math.round(value));
  return (
    <ToggleButtonGroup
      className="segmented"
      aria-label={metaOf(def.key).label}
      value={[current]}
      // Pressing the lit button would otherwise clear the group to no
      // selection, which is not a state a param can be in.
      onValueChange={(ids) => onChange(Number(ids[0] ?? current))}
    >
      {(metaOf(def.key).options ?? []).map((opt, i) => (
        <ToggleButton key={opt} size="sm" value={String(i)}>
          {opt}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
