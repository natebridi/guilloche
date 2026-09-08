import { memo } from "react";
import { Adorn, Tooltip, Typography } from "@jig-ui/react";
import { type ParamDef } from "../schema";
import { metaOf } from "../paramMeta";
import { displayOf, formatDisplay } from "./units";
import { ParamSegmented, ParamSlider } from "./controls";

interface ParamRowProps {
  def: ParamDef;
  value: number;
  onChange: (key: string, value: number) => void;
}

// One label + control + value readout. Memoized so only the changed row
// re-renders while a slider is dragged (onChange from ControlRail is stable).
//
// Every piece of text here is a Jig component; styles.css only positions them.
// `caption02` is sans/scale-200, which is what Jig's own Slider renders its
// label at, so the enum rows line up with the slider rows. Typography's base
// already sets text.primary, the same colour the Slider label takes.
export const ParamRow = memo(function ParamRow({ def, value, onChange }: ParamRowProps) {
  const set = (v: number) => onChange(def.key, v);

  // A slider's label comes from Jig's own `label` prop; an enum's has no
  // control to belong to, so it is a plain span rather than a second,
  // competing <label> — ToggleButtonGroup is already named via aria-label.
  if (def.type === "enum") {
    const meta = metaOf(def.key);
    return (
      <div className="row">
        {/* Typography forwards a ref through PolymorphicProps, so it can be the
            tooltip's trigger directly rather than needing a wrapper span. */}
        <Tooltip content={meta.description} placement="left" delay={350}>
          <Typography as="span" with="caption02" className="row-label">
            {meta.label}
          </Typography>
        </Tooltip>
        <ParamSegmented def={def} value={value} onChange={set} />
      </div>
    );
  }

  const display = displayOf(def);
  return (
    <div className="row">
      <ParamSlider def={def} value={value} onChange={set} />
      {/* Adorn is the primitive for exactly this — its own docs name "a column
          of figures" as the `mono` case. One job each: mono sets the family for
          the whole readout, accent carries the figure, muted de-emphasises the
          unit so the number stays what the eye catches scanning the column. */}
      <Adorn className="row-value" with="mono">
        {formatDisplay(display, display.toDisplay(value))}
        <Adorn with="muted">{display.unit}</Adorn>
      </Adorn>
    </div>
  );
});
