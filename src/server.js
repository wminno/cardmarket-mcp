import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tools } from "./tools.js";

export function buildServer() {
  const server = new McpServer({ name: "cardmarket-mcp", version: "0.1.0" });
  for (const t of tools) {
    server.registerTool(t.name, { title: t.title, description: t.description, inputSchema: t.schema, annotations: { readOnlyHint: true, openWorldHint: true } }, async (args) => {
      try {
        return { content: [{ type: "text", text: JSON.stringify(await t.run(args), null, 2) }] };
      } catch (e) {
        return { isError: true, content: [{ type: "text", text: String(e.message || e) }] };
      }
    });
  }
  return server;
}
