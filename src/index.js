#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { tools } from "./tools.js";

const server = new McpServer({ name: "cardmarket-mcp", version: "0.1.0" });
for (const t of tools) {
  server.registerTool(t.name, { title: t.title, description: t.description, inputSchema: t.schema, annotations: { readOnlyHint: true, openWorldHint: true } }, async (args) => {
    try {
      const out = await t.run(args);
      return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: String(e.message || e) }] };
    }
  });
}
await server.connect(new StdioServerTransport());
