/**
 * Thin OpenAI-compatible Chat Completions client for enrichment.
 * Requires OPEN_CODE_BASE_URL (no trailing slash) + OPENCODE_API_KEY; optional OPEN_CODE_MODEL.
 */

/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {Response} res
 */
function retryAfterMs(res) {
  const ra = res.headers.get("retry-after");
  if (ra) {
    const n = Number.parseInt(ra, 10);
    if (Number.isFinite(n)) return n * 1000;
  }
  return 2000;
}

/**
 * @param {string} baseUrl e.g. https://gateway.example/v1
 * @param {string} apiKey
 * @param {string} model
 * @param {string} system
 * @param {string} user
 * @param {{ maxTokens?: number, signal?: AbortSignal }} opts
 * @returns {Promise<string>} assistant message content
 */
export async function openCodeChatJsonPrompt(
  baseUrl,
  apiKey,
  model,
  system,
  user,
  opts = {},
) {
  const maxTokens = opts.maxTokens ?? 900;
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const body = {
    model,
    temperature: 0,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };

  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    if (res.status === 429 || res.status === 503) {
      await sleep(Math.min(retryAfterMs(res) + attempt * 500, 120_000));
      continue;
    }
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`OpenCode HTTP ${res.status}: ${t.slice(0, 500)}`);
    }
    const data = /** @type {any} */ (await res.json());
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("OpenCode: empty choices[0].message.content");
    }
    return content.trim();
  }
  throw new Error("OpenCode: gave up retrying after rate limits");
}
