import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Type } from "typebox";

export default async function (pi: ExtensionAPI) {
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  const serverPath = process.env.GITHUB_MCP_SERVER_PATH || "github-mcp-server";

  if (!token) {
    pi.on("session_start", async (_event, ctx) => {
      ctx.ui.notify(
        "GitHub MCP: GITHUB_TOKEN or GITHUB_PERSONAL_ACCESS_TOKEN not set. GitHub tools unavailable.",
        "error"
      );
    });
    return;
  }

  const client = new Client({ name: "pi-github-mcp", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: serverPath,
    args: ["stdio"],
    env: {
      ...process.env,
      GITHUB_PERSONAL_ACCESS_TOKEN: token,
    },
  });

  try {
    await client.connect(transport);
  } catch (err: any) {
    pi.on("session_start", async (_event, ctx) => {
      ctx.ui.notify(`GitHub MCP: failed to connect: ${err.message}`, "error");
    });
    return;
  }

  const toolsResponse = await client.listTools();
  const tools = toolsResponse.tools || [];

  for (const tool of tools) {
    const schema = jsonSchemaToTypebox(tool.inputSchema as any);

    pi.registerTool({
      name: `github_${tool.name}`,
      label: `GitHub: ${tool.name}`,
      description: tool.description || `GitHub MCP tool: ${tool.name}`,
      parameters: schema,
      async execute(_toolCallId, params, _signal, onUpdate, _ctx) {
        onUpdate?.({ content: [{ type: "text", text: `Running GitHub ${tool.name}...` }] });

        const result = await client.callTool({
          name: tool.name,
          arguments: params as Record<string, unknown>,
        });

        const texts: string[] = [];
        for (const item of result.content as any[]) {
          if (item.type === "text") {
            texts.push(item.text);
          } else if (item.type === "image") {
            texts.push(`[Image: ${item.mimeType}]`);
          } else if (item.type === "resource") {
            texts.push(`[Resource: ${item.resource?.uri || ""}]`);
          }
        }

        return {
          content: [{ type: "text", text: texts.join("\n") || "(no output)" }],
          details: result,
        };
      },
    });
  }

  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify(`GitHub MCP loaded with ${tools.length} tool(s).`, "info");
  });

  pi.on("session_shutdown", async (_event, _ctx) => {
    try {
      await client.close();
    } catch {
      // ignore cleanup errors
    }
  });
}

function jsonSchemaToTypebox(schema: any): any {
  if (!schema || typeof schema !== "object") {
    return Type.Object({});
  }

  if (schema.type === "object" || (!schema.type && schema.properties)) {
    const props: Record<string, any> = {};
    const required = new Set(schema.required || []);
    for (const [key, prop] of Object.entries<any>(schema.properties || {})) {
      const tb = jsonSchemaPropToTypebox(prop);
      props[key] = required.has(key) ? tb : Type.Optional(tb);
    }
    return Type.Object(props);
  }

  return Type.Object({});
}

function jsonSchemaPropToTypebox(prop: any): any {
  if (!prop || typeof prop !== "object") return Type.String();

  switch (prop.type) {
    case "string":
      if (prop.enum && Array.isArray(prop.enum)) {
        return Type.Union(prop.enum.map((e: string) => Type.Literal(e)));
      }
      return Type.String({ description: prop.description });
    case "number":
    case "integer":
      return Type.Number({ description: prop.description });
    case "boolean":
      return Type.Boolean({ description: prop.description });
    case "array":
      return Type.Array(jsonSchemaPropToTypebox(prop.items), { description: prop.description });
    case "object":
      return jsonSchemaToTypebox(prop);
    default:
      return Type.String({ description: prop.description });
  }
}
