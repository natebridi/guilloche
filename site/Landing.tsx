import type { ReactNode } from "react";
import { Grid, Stack, Button, Typography, Adorn, CodeBlock, ToggleButton, ToggleButtonGroup, Box, Link } from "@jig-ui/react";
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

export function Landing() {
  return (
    <Stack as="main" direction="column" spacing="900">

      <Stack style={{ minHeight: '60vh', width: '100vw' }} justify='center'>

        <Grid columns={24} style={{  maxWidth: '60rem', marginInline: 'auto' }}>
          <Box span={{ xs: 24, md: 8 }} alignSelf='center' mb="600" style={{ zIndex: 3 }}>
            <Typography as="h1" with="display01" mb="300">Guilloche</Typography>
            <Typography as="p" with="display05" pl="300" balance>Shader for patterns etched in metal</Typography>
            <Box mt="600" pl="300">
              <Link variant="smoke" icon="arrow-right" iconPosition="end" href="/create">Create your guilloché</Link>
            </Box>
          </Box>
          <Stack spacing="500" py="600" align="center" span={{ xs: 24, md: 16 }} style={{ zIndex: 2 }}>
            <Box style={{
              overflow: 'hidden',
              position: 'relative',
              borderRadius: '1rem',
              aspectRatio: '5/3',
              width: '30rem',
              placeContent: 'center'
            }}>
              <guilloche-pattern style={{ position: 'absolute', inset: 0, aspectRatio: '5/3' }} params="v1&pr=sunburst" />
              <guilloche-pattern style={{ position: 'absolute', width: '20%', borderRadius: 999, placeSelf: 'center' }} params="v1&amp;sc=1.5&amp;d=20&amp;pa=0.575959&amp;pt=0.08&amp;a1=0&amp;f1=35&amp;a2=0&amp;at=0.4&amp;tw=3&amp;wa=1.52&amp;wf=4.5&amp;mt=1&amp;ir=1&amp;sp=3.72&amp;ks=1.35&amp;lu=0.197222&amp;la=1&amp;en=0.25&amp;eh=0.088889&amp;ed=6&amp;fg=0.15" />
            </Box>
            <ToggleButtonGroup>
              <ToggleButton value="style1" pressedIcon='eye'>Golden sun</ToggleButton>
              <ToggleButton value="style2" pressedIcon='eye'>Silver burst</ToggleButton>
              <ToggleButton value="style3" pressedIcon='eye'>Ocean drop</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Grid>

        <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          <guilloche-pattern style={{ width: '100%', height: '100%' }} params="v1&pr=black-card" />
        </div>

      </Stack>


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

interactive  "track"  the pointer aims the key light from anywhere on
                      the page, so it keeps aiming when something is
                      layered over the plate (default)
             "hover"  only aim while the pointer is over the element
             "off"    static; no listeners at all
             "gyro"   track, plus device orientation. Needs HTTPS, and
                      renders an "Enable motion" button on iOS.

             The aim holds its last value whenever the pointer is
             lost — it never snaps back to the default azimuth.

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
