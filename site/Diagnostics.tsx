import { useEffect, useState } from "react";
import { Button, Stack, Typography, Adorn } from "@jig-ui/react";
import { color, spacing } from "@jig-ui/react/tokens";

// Device orientation fails silently in two different ways (insecure origin,
// and iOS's user-gesture requirement), which is indistinguishable from "the
// feature is broken" without something like this. Keep it on the page: it is
// the fastest way to answer "why isn't gyro doing anything" on a real phone.

type Row = [label: string, value: string, ok: boolean | null];

function readEnvironment(): Row[] {
  const hasDOE = typeof DeviceOrientationEvent !== "undefined";
  const needsPermission =
    hasDOE &&
    typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown })
      .requestPermission === "function";

  return [
    ["Origin", location.origin, null],
    [
      "Secure context",
      String(window.isSecureContext),
      window.isSecureContext,
    ],
    ["DeviceOrientationEvent", String(hasDOE), hasDOE],
    ["requestPermission exposed", String(needsPermission), null],
  ];
}

export function Diagnostics() {
  const [rows, setRows] = useState<Row[]>(readEnvironment);
  const [events, setEvents] = useState(0);
  const [gyro, setGyro] = useState<string>("(not mounted)");

  useEffect(() => {
    const onOrient = () => setEvents((n) => n + 1);
    const onGyro = (e: Event) => setGyro(String((e as CustomEvent).detail));
    window.addEventListener("deviceorientation", onOrient);
    window.addEventListener("guilloche:gyro", onGyro);

    // The element mounts lazily (IntersectionObserver), so its state may not
    // exist yet when this panel first renders.
    const el = document.querySelector<HTMLElement>(
      'guilloche-pattern[interactive="gyro"]',
    );
    if (el?.dataset.gyro) setGyro(el.dataset.gyro);

    return () => {
      window.removeEventListener("deviceorientation", onOrient);
      window.removeEventListener("guilloche:gyro", onGyro);
    };
  }, []);

  const all: Row[] = [
    ...rows,
    ["deviceorientation events", String(events), events > 0],
    ["Element data-gyro", gyro, gyro === "granted"],
  ];

  return (
    <Stack direction="column" spacing="400">
      {/* A native <dl>: Jig's `as` unions cover prose and layout elements, not
          description lists, so the semantics have to come from real markup
          with Typography nested inside the terms rather than wrapping them. */}
      <dl
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing[200],
          margin: 0,
          padding: spacing[500],
          background: color.surfaces.card,
          borderRadius: "var(--radius-300)",
        }}
      >
        {all.map(([label, value, ok]) => (
          <Stack
            key={label}
            direction={{ xs: "column", sm: "row" }}
            spacing="200"
            align={{ xs: "start", sm: "baseline" }}
          >
            <dt style={{ minWidth: "14rem" }}>
              <Typography with="caption01" style={{ color: color.text.secondary }}>
                {label}
              </Typography>
            </dt>
            <dd style={{ margin: 0 }}>
              <Typography with="body02" style={{ fontFamily: "var(--type-family-mono)" }}>
              {ok === null ? (
                value
              ) : (
                <Adorn with={ok ? "accent" : "danger"}>{value}</Adorn>
              )}
              </Typography>
            </dd>
          </Stack>
        ))}
      </dl>

      <Stack direction="row" spacing="300" align="center">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setRows(readEnvironment());
            setEvents(0);
          }}
        >
          Re-check
        </Button>
        <Typography with="caption02" style={{ color: color.text.secondary }}>
          Tilt the device — the event counter should climb once motion is
          granted.
        </Typography>
      </Stack>
    </Stack>
  );
}
