import type { ReactNode } from "react";
import { Grid, Stack, Typography, Adorn, CodeBlock } from "@jig-ui/react";
import { color } from "@jig-ui/react/tokens";
import { Diagnostics } from "./Diagnostics";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack as="section" direction="column" spacing="400">
      <Typography as="h2" with="heading03">
        {title}
      </Typography>
      {children}
    </Stack>
  );
}

function Lead({ children }: { children: ReactNode }) {
  return (
    <Typography with="body01" style={{ maxWidth: "62ch", color: color.text.secondary }}>
      {children}
    </Typography>
  );
}

function Sample({ label, params, ...rest }: { label: string; params: string } & Record<string, unknown>) {
  return (
    <figure className="figure">
      <Stack direction="column" spacing="200">
        <guilloche-pattern params={params} {...rest} />
        <Typography as="figcaption" with="caption02" style={{ color: color.text.secondary }}>
          {label}
        </Typography>
      </Stack>
    </figure>
  );
}

export function EmbedDemo() {
  return (
    <Stack as="main" className="page" direction="column" spacing="900">
      <Stack direction="column" spacing="300">
        <Typography as="h1" with="display01">
          Guilloche
        </Typography>
        <Typography as="p" with="body02">
          Drop-in WebGL2 guilloché patterns. One script tag, then an element.
          Configuration is the same string the editor's <Adorn with="semibold">Copy
          link</Adorn> button produces, so a shared link and an embed are
          interchangeable.
        </Typography>
        <CodeBlock>{`<script type="module"
  src="https://cdn.jsdelivr.net/npm/@natebridi/guilloche@0.1/dist-embed/guilloche-element.js"></script>

<guilloche-pattern params="v1&pr=barleycorn" style="width:480px"></guilloche-pattern>`}</CodeBlock>
      </Stack>

      <Section title="By preset name">
        <Lead>
          A bare <Adorn with="semibold">pr=&lt;name&gt;</Adorn> resolves to that
          preset's full parameter set — the shortest possible embed.
        </Lead>
        <Grid columns={{ xs: 1, sm: 2, lg: 4 }} spacing="400">
          <Sample label="pr=rosette" params="v1&pr=rosette" />
          <Sample label="pr=barleycorn" params="v1&pr=barleycorn" />
          <Sample label="pr=sunburst" params="v1&pr=sunburst" />
          <Sample label="pr=certificate" params="v1&pr=certificate" />
        </Grid>
      </Section>

      <Section title="By explicit parameters">
        <Lead>Any tweaked state from the editor pastes in the same way.</Lead>
        <Grid columns={{ xs: 1, sm: 2, lg: 3 }} spacing="400">
          <Sample
            label="gold, twisted — interactive=gyro"
            params="v1&d=44&ml=1&a1=0.035&f1=24&tw=0.9&ps=2&po=3.1416&mt=1"
            interactive="gyro"
          />
          <Sample
            label="flat, ink on paper"
            params="v1&sh=0&iv=1&d=60&a1=0.1&f1=5&a2=0.05&f2=7&p2=1.2"
          />
          <Sample
            label="iridescent"
            params="v1&d=72&ir=0.8&gl=0.6&at=0.28&tw=0.35&f1=11"
          />
        </Grid>
      </Section>

      <Section title="Motion diagnostics">
        <Lead>
          Device orientation requires a <Adorn with="semibold">secure context</Adorn>.
          Over plain <code>http://</code> on a LAN address it is unavailable and
          fails silently at the browser level — open this page over HTTPS (or on{" "}
          <code>localhost</code>) to use <code>interactive="gyro"</code>.
        </Lead>
        <Diagnostics />
      </Section>

      <Section title="As a banner">
        <Lead>
          The element defaults to a 1:1 aspect ratio and full width — override
          either with plain CSS.
        </Lead>
        <guilloche-pattern
          className="banner"
          params="v1&mo=1&d=24&of=0.1&a1=0.08&f1=3&a2=0.03&f2=8&ps=2&po=3.1416"
        />
      </Section>

      <Section title="Attributes">
        <CodeBlock>{`params       Editor share-link string. Reactive — change it and the
             pattern updates in place. Unset params fall back to defaults.

interactive  "hover"  the pointer aims the key light while over the
                      element (default)
             "off"    static; no listeners at all
             "gyro"   hover, plus device orientation. Needs HTTPS, and
                      renders an "Enable motion" button on iOS.

max-dpr      Cap on devicePixelRatio. Default 2. Lower it for large
             embeds — the shader is expensive per-pixel.`}</CodeBlock>
        <Grid columns={{ xs: 1, sm: 2 }} spacing="400">
          <Sample label='interactive="off"' params="v1&pr=net" interactive="off" />
          <Sample label='max-dpr="1"' params="v1&pr=net" max-dpr="1" />
        </Grid>
      </Section>

      <Stack as="section" spacing="400" align="stretch">
        <Typography as="p" with="heading03">Fallback</Typography>
        <Typography as="p" with="body02" mb="300">
          Child content shows only if a WebGL2 context can't be created — put a
          poster image there for the small fraction of visitors without it.
        </Typography>
        <CodeBlock label="html">{`<guilloche-pattern params="v1&pr=rosette">
  <img src="poster.png" alt="Guilloché pattern" />
</guilloche-pattern>`}</CodeBlock>
      </Stack>

      <Section title="Programmatic use">
        <CodeBlock label="js">{`import { mountGuilloche, decode, schemaDefaults }
  from "@natebridi/guilloche";

const handle = mountGuilloche(canvas, {
  params: { ...schemaDefaults(), ...decode("v1&pr=sunburst").params },
  interactive: true,
});

handle.setParams({ twist: 1.2 });   // live update
handle.setActive(false);            // idle the render loop
handle.destroy();                   // release the GL context`}</CodeBlock>
      </Section>
    </Stack>
  );
}
