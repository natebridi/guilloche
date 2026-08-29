import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Button, ToggleButton, ToggleButtonGroup } from "@jig-ui/react";
import { GuillocheEngine, WebGL2UnavailableError } from "../engine/GuillocheEngine";
import { mountGuilloche, type MountHandle } from "../engine/mount";
import type { GyroState } from "../engine/pointerInput";
import { FRAMES } from "./frames";

const MAX_TILT_DEG = 10;

interface StageProps {
  engineRef: MutableRefObject<GuillocheEngine | null>;
  initialParams: Record<string, number>;
  params: Record<string, number>;
}

export function Stage({ engineRef, initialParams, params }: StageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  // Preview frame is view-only state (not a pattern param): it reshapes the
  // canvas, and the ResizeObserver below re-fits the render automatically.
  const [frameId, setFrameId] = useState("full");
  // Set when the engine can't be constructed; swaps the canvas for a message.
  const [failed, setFailed] = useState(false);
  // "prompt" on iOS, where device orientation needs an explicit user gesture.
  const [gyroState, setGyroState] = useState<GyroState>("unsupported");
  const handleRef = useRef<MountHandle | null>(null);
  const frame = FRAMES.find((f) => f.id === frameId) ?? FRAMES[0];
  // Read inside the (once-mounted) input handler without re-subscribing.
  const tiltRef = useRef(frame.tilt);
  tiltRef.current = frame.tilt;

  // Clear any lingering tilt transform when switching frames (the frame div is
  // reused across frames, so an inline transform would otherwise persist).
  useEffect(() => {
    if (frameRef.current) frameRef.current.style.transform = "";
  }, [frameId]);

  // Instantiate + drive the engine once. React never touches GL beyond this.
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    let handle: ReturnType<typeof mountGuilloche>;
    try {
      handle = mountGuilloche(canvas, {
        params: initialParams,
        // The app tracks the pointer across the whole page (the plate is the
        // subject here) and offers gyro; an embed does neither by default.
        pointerTarget: stage,
        pointer: { scope: "window", gyro: true, resetOnLeave: false },
        onGyroState: setGyroState,
        // The aim signal drives BOTH the key light (via the engine) and the
        // card's 3D tilt (pure CSS) — the tilt is app chrome, so it lives here
        // rather than in the shared mount.
        onAim: (x, y) => {
          const el = frameRef.current;
          if (el && tiltRef.current) {
            el.style.transform =
              `perspective(820px) rotateX(${(y * MAX_TILT_DEG).toFixed(2)}deg) ` +
              `rotateY(${(x * MAX_TILT_DEG).toFixed(2)}deg) scale(1.02)`;
          }
        },
      });
    } catch (err) {
      // No context available: show the empty state, quietly. Anything else is
      // a real bug (shader compile/link), so let it reach the console.
      if (!(err instanceof WebGL2UnavailableError)) console.error(err);
      setFailed(true);
      return;
    }
    engineRef.current = handle.engine;
    handleRef.current = handle;

    // The tilt deliberately HOLDS when the pointer leaves the page, matching
    // the key light: both are driven by the same aim signal, and losing the
    // pointer says nothing about where the plate should be facing. Springing
    // only the tilt back left the two visibly disagreeing.
    return () => {
      handle.destroy();
      engineRef.current = null;
      handleRef.current = null;
    };
    // Engine is created once; params flow in via engine.setParams (App).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mode = params.mode < 0.5 ? "RADIAL" : "LINEAR";
  const passes = Math.round(params.passes);
  const passLabel = passes === 1 ? "1 PASS" : `${passes} PASSES`;
  const render = params.shaded ? "RELIEF" : "FLAT";

  // Frame chrome and the caption describe a render that doesn't exist here, so
  // the empty state replaces the whole stage rather than sitting inside it.
  if (failed) {
    return (
      <div className="stage" ref={stageRef}>
        <p className="stage-empty">This tool requires WebGL2.</p>
      </div>
    );
  }

  return (
    <div className="stage" ref={stageRef}>
      <ToggleButtonGroup
        className="frame-toolbar"
        aria-label="Preview frame"
        value={[frameId]}
        // Deselecting would leave the stage with no frame at all, so clicking
        // the lit button keeps the current one.
        onValueChange={(ids) => setFrameId(ids[0] ?? frameId)}
      >
        {FRAMES.map((f) => (
          <ToggleButton key={f.id} size="sm" value={f.id}>
            {f.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <div className="frame-viewport">
        <div ref={frameRef} className={`frame ${frame.className}${frame.tilt ? " frame-tilt" : ""}`}>
          <canvas ref={canvasRef} className="stage-canvas" />
        </div>
      </div>
      {gyroState === "prompt" && (
        <Button
          className="gyro-btn"
          size="sm"
          variant="secondary"
          // iOS grants device-orientation permission only from a real gesture,
          // so this has to be an explicit control rather than an auto-request.
          onClick={() => {
            void handleRef.current?.requestGyro().then(setGyroState);
          }}
        >
          Enable motion
        </Button>
      )}
      <div className="stage-caption">{`${mode} · ${passLabel} · ${render}`}</div>
    </div>
  );
}
