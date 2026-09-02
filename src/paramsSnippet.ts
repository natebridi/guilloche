// Builds the JS params object the editor hands out. Kept beside embedSnippet
// for the same reason: the shape of what gets copied is policy, and policy
// belongs somewhere testable rather than inline in a click handler.

import { SCHEMA } from "./schema";

// Schema keys are camelCase identifiers today, so they need no quoting. This
// only bites if one ever isn't, which would produce invalid JS silently.
const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * The current params as a copy-pasteable JS object literal.
 *
 * Only values that DIFFER from the schema default are written, which is the
 * same rule `encode()` follows — the full set is 60-odd keys and almost all of
 * them would be noise. That makes the result a PATCH, and the header comment
 * says so, because the two ways to spend it want different things:
 * `setParams()` merges a patch into a live engine, while `mountGuilloche()`
 * takes the engine's whole params map and would leave every omitted uniform
 * unset.
 */
export function paramsSnippet(params: Record<string, number>): string {
  const entries = SCHEMA.filter(
    (d) => params[d.key] !== undefined && params[d.key] !== d.default,
  ).map((d) => {
    const key = IDENT.test(d.key) ? d.key : JSON.stringify(d.key);
    return `  ${key}: ${params[d.key]},`;
  });

  const header =
    "// Guilloché — the values that differ from the schema defaults.\n" +
    "// handle.setParams(params) to patch a live engine, or spread over\n" +
    "// schemaDefaults() to build a full set for mountGuilloche().";

  if (entries.length === 0) {
    return `${header}\nconst params = {};`;
  }
  return `${header}\nconst params = {\n${entries.join("\n")}\n};`;
}
