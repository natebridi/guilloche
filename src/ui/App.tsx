import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { GuillocheEngine } from "../engine/GuillocheEngine";
import { schemaDefaults } from "../schema";
import { decode, encode } from "../urlState";
import { randomizePatch } from "../randomize";
import { presetParams, type Preset } from "../presets";
import { embedSnippet } from "../embedSnippet";
import { Stage } from "./Stage";
import { ControlRail } from "./ControlRail";

type Params = Record<string, number>;

// A patch is just some keys; under the index signature that's still Params.
function reducer(state: Params, patch: Params): Params {
  return { ...state, ...patch };
}

export function App() {
  // Initial state = schema defaults overlaid with anything in the URL.
  const decoded = useMemo(() => decode(location.search), []);
  const initial = useMemo<Params>(
    () => ({ ...schemaDefaults(), ...decoded.params }),
    [decoded],
  );
  const [params, dispatch] = useReducer(reducer, initial);
  // Which preset the current state came from, or null once it's been touched.
  // Tracked as an event ("a preset was applied, then nothing was edited")
  // rather than derived by comparing params, so a manual edit that happens to
  // land back on a preset value doesn't re-light the pill.
  const [activePreset, setActivePreset] = useState<string | null>(decoded.preset);
  const engineRef = useRef<GuillocheEngine | null>(null);

  // Every change: update React state (for the UI) AND the engine (for GL).
  // engine.setParams merges + marks dirty, so the canvas updates next frame
  // regardless of React's re-render timing.
  const applyPatch = useCallback((patch: Params) => {
    dispatch(patch);
    engineRef.current?.setParams(patch);
  }, []);

  // Manual edits go through the same path as presets, and clear the pill.
  const onChange = useCallback(
    (key: string, value: number) => {
      setActivePreset(null);
      applyPatch({ [key]: value });
    },
    [applyPatch],
  );

  // Presets reset unlisted params to their defaults first, so the result is
  // the preset's full state and not a merge with whatever preceded it.
  const onPreset = useCallback(
    (preset: Preset) => {
      applyPatch(presetParams(preset));
      setActivePreset(preset.id);
    },
    [applyPatch],
  );

  const onRandomize = useCallback(() => {
    setActivePreset(null);
    applyPatch(randomizePatch(params));
  }, [applyPatch, params]);

  const onReset = useCallback(() => {
    setActivePreset(null);
    applyPatch(schemaDefaults());
  }, [applyPatch]);

  // Debounced URL sync (300ms). Skip the first run so we don't rewrite the URL
  // just from loading.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const id = window.setTimeout(() => {
      history.replaceState(
        null,
        "",
        `${location.pathname}?${encode(params, activePreset)}`,
      );
    }, 300);
    return () => window.clearTimeout(id);
  }, [params, activePreset]);

  const copyLink = useCallback(async () => {
    const url = `${location.origin}${location.pathname}?${encode(params, activePreset)}`;
    history.replaceState(null, "", url);
    await navigator.clipboard?.writeText(url);
  }, [params, activePreset]);

  // The embed carries the same param string as the link, so a pattern tuned
  // here drops straight onto another page.
  const copyEmbed = useCallback(async () => {
    await navigator.clipboard?.writeText(
      embedSnippet({ params: encode(params, activePreset) }),
    );
  }, [params, activePreset]);

  return (
    <div className="app">
      <Stage engineRef={engineRef} initialParams={initial} params={params} />
      <ControlRail
        params={params}
        activePreset={activePreset}
        onChange={onChange}
        onPreset={onPreset}
        onRandomize={onRandomize}
        onReset={onReset}
        onCopyLink={copyLink}
        onCopyEmbed={copyEmbed}
      />
    </div>
  );
}
