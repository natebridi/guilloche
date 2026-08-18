// Builds the copy-paste embed snippet the editor hands out. Kept out of the UI
// so the CDN/versioning policy lives in one testable place.

const CDN = "https://cdn.jsdelivr.net/npm";

// Pin embeds to a range that receives fixes but never a breaking change:
// "1.4.2" -> "1", "0.1.0" -> "0.1" (under semver, 0.x treats minor as major).
// Never emit @latest — a future breaking release would break every page that
// already pasted the snippet.
export function pinnedRange(version: string): string {
  const [major, minor] = version.split(".");
  return major === "0" ? `0.${minor ?? 0}` : major;
}

// `&` must be escaped inside an HTML attribute. Browsers are lenient about it,
// but the snippet is pasted into other people's pages and should be correct
// HTML, not merely-parses HTML.
function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface SnippetOptions {
  params: string; // the encode() string, e.g. "v1&d=44&tw=0.9"
  name?: string;
  version?: string;
  width?: string;
}

export function embedSnippet({
  params,
  name = __PKG_NAME__,
  version = __PKG_VERSION__,
  width = "480px",
}: SnippetOptions): string {
  const src = `${CDN}/${name}@${pinnedRange(version)}/dist-embed/guilloche-element.js`;
  return (
    `<script type="module" src="${src}"><\/script>\n` +
    `<guilloche-pattern params="${escapeAttr(params)}" style="width:${width}"><\/guilloche-pattern>`
  );
}
