#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "./server.js";
if (process.argv.includes("--http")) await import("./http.js");
else await buildServer().connect(new StdioServerTransport());
