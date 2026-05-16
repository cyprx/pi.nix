import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  const searxngUrl = (process.env.SEARXNG_URL || "https://search.sapti.me").replace(/\/$/, "");

  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description: "Search the web for current information, news, documentation, or facts.",
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

      const url = new URL(`${searxngUrl}/search`);
      url.searchParams.set("q", query);
      url.searchParams.set("format", "json");
      url.searchParams.set("safesearch", "0");

      let response: Response;
      try {
        response = await fetch(url.toString(), { signal });
      } catch (err: any) {
        throw new Error(`Network error contacting search engine: ${err.message}`);
      }

      if (!response.ok) {
        throw new Error(`Search engine returned ${response.status}: ${response.statusText}`);
      }

      let data: any;
      try {
        data = await response.json();
      } catch (err: any) {
        throw new Error(`Failed to parse search response: ${err.message}`);
      }

      const results = (data.results || []).slice(0, count);

      const lines: string[] = [];
      lines.push(`Web search results for "${query}" (${results.length} result${results.length === 1 ? "" : "s"}):\n`);

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        lines.push(`[${i + 1}] ${r.title || "(no title)"}`);
        lines.push(`    URL: ${r.url || r.pretty_url || ""}`);
        lines.push(`    ${(r.content || r.abstract || "(no snippet)").replace(/\s+/g, " ").trim()}`);
        lines.push("");
      }

      return {
        content: [{ type: "text", text: lines.join("\n") || "No results found." }],
        details: { engine: searxngUrl, results: data.results },
      };
    },
  });
}
