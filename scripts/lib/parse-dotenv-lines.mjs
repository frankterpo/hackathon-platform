/**
 * Minimal dotenv line parser (KEY=VALUE, optional double/single quotes).
 * Skips blank lines and #-comments. No multiline values.
 * @param {string} content
 * @returns {Array<[string, string]>}
 */
export function parseDotenvLines(content) {
  const out = [];
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out.push([key, value]);
  }
  return out;
}

/**
 * @param {string} value
 * @returns {string}
 */
export function encodeDotenvValue(value) {
  if (/[\s#"']/.test(value) || value === "") {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return value;
}
