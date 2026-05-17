import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  // User-configurable SearXNG instance(s). Comma-separated for fallback.
  const envUrls = process.env.SEARXNG_URL;
  const fallbackUrls = [
    "https://search.sapti.me",
    "https://search.bus-hit.me",
    "https://search.blitzw.in",
    "https://search.datura.network",
  ];
  const urls = envUrls
    ? envUrls.split(",").map((u) => u.trim().replace(/\/$/, ""))
    : fallbackUrls;

  const headers = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    Accept: "application/json",
  };

  async function searchOne(baseUrl: string, query: string, count: number, signal?: AbortSignal) {
    const url = new URL(`${baseUrl}/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("safesearch", "0");

    const response = await fetch(url.toString(), { signal, headers });

    if (!response.ok) {
      const bodyPreview = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status}: ${response.statusText}. Body preview: ${bodyPreview.slice(0, 200)}`);
    }

    const bodyText = await response.text();
    let data: any;
    try {
      data = JSON.parse(bodyText);
    } catch (err: any) {
      throw new Error(`JSON parse error: ${err.message}. Body preview: ${bodyText.slice(0, 300)}`);
    }

    const results = (data.results || []).slice(0, count);
    return { results, engine: baseUrl, total: data.results?.length ?? 0 };
  }

  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description:
      "Search the web for current information, news, documentation, or facts. Uses SearXNG instances with automatic fallback.",
    promptSnippet: "Search the web for current information",
    promptGuidelines: [
      "Use web_search when the user asks about recent events, current data, or topics that may have changed after your training cutoff.",
      "Use web_search when the user asks about software versions, API documentation, or library features that may have been updated.",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "The search query to execute" }),
      count: Type.Optional(Type.Number({ description: "Number of results to return (default 5, max 10)" })),
    }),
    async execute(_toolCallId, params, signal, onUpdate, _ctx) {
      const query = params.query;
      const count = Math.min(params.count || 5, 10);

      onUpdate?.({ content: [{ type: "text", text: `Searching web for: ${query}...` }] });

      let lastError: Error | undefined;
      for (const baseUrl of urls) {
        try {
          const { results, engine, total } = await searchOne(baseUrl, query, count, signal);

          const lines: string[] = [];
          lines.push(`Web search results for "${query}" (${results.length} of ${total} result${total === 1 ? "" : "s"} from ${engine}):\n`);

          for (let i = 0; i < results.length; i++) {
            const r = results[i];
            lines.push(`[${i + 1}] ${r.title || "(no title)"}`);
            lines.push(`    URL: ${r.url || r.pretty_url || ""}`);
            lines.push(`    ${(r.content || r.abstract || "(no snippet)").replace(/\s+/g, " ").trim()}`);
            lines.push("");
          }

          return {
            content: [{ type: "text", text: lines.join("\n") || "No results found." }],
            details: { engine, results: results },
          };
        } catch (err: any) {
          lastError = err;
          onUpdate?.({ content: [{ type: "text", text: `${baseUrl} failed (${err.message}), trying next...` }] });
          continue;
        }
      }

      throw new Error(`All search engines failed. Last error: ${lastError?.message || "unknown"}`);
    },
  });
}
