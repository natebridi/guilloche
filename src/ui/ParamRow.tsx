import { memo } from "react";
import { type ParamDef } from "../schema";
import { displayOf, formatDisplay } from "./units";
import { ParamSegmented, ParamSlider } from "./controls";

interface ParamRowProps {
  def: ParamDef;
  value: number;
  onChange: (key: string, value: number) => void;
}

// One label + control + mono value. Memoized so only the changed row re-renders
// while a slider is dragged (onChange from ControlRail is stable).
export const ParamRow = memo(function ParamRow({ def, value, onChange }: ParamRowProps) {
  const set = (v: number) => onChange(def.key, v);

  // The Jig controls carry their own accessible name (Slider via `label`,
  // ToggleButtonGroup via `aria-label`), so the enum's visible label is a plain
  // span rather than a second, competing <label>.
  if (def.type === "enum") {
    return (
      <div className="row">
        <span className="row-label">{def.label}</span>
        <ParamSegmented def={def} value={value} onChange={set} />
      </div>
    );
  }

  const display = displayOf(def);
  return (
    <div className="row">
      <ParamSlider def={def} value={value} onChange={set} />
      <span className="row-value">
        {formatDisplay(display, display.toDisplay(value))}
        <i className="row-unit">{display.unit}</i>
      </span>
    </div>
  );
});
