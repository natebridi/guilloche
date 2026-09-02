// Package entry: the programmatic API, with NO side effects. Importing this
// does not register the custom element — call defineGuillocheElement() for
// that, or import "@natebridi/guilloche/element" which does it for you.

export {
  GuillocheEngine,
  WebGL2UnavailableError,
  type EngineOptions,
  type ProbeOptions,
  type ProbeResult,
} from "./engine/GuillocheEngine";
export {
  mountGuilloche,
  type MountOptions,
  type MountHandle,
} from "./engine/mount";
export {
  attachPointerInput,
  type PointerInputOptions,
  type PointerInputHandle,
  type AimHandler,
  type GyroState,
} from "./engine/pointerInput";
export {
  defineGuillocheElement,
  type GuillochePatternElement,
} from "./element";
export { decode, encode, type DecodedState } from "./urlState";
export {
  PRESETS,
  presetParams,
  findPreset,
  type Preset,
} from "./presets";
export {
  SCHEMA,
  schemaDefaults,
  groupsInOrder,
  type ParamDef,
  type ParamType,
} from "./schema";
