import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { runSajuCalc } from "./saju-engine.js";

// stdout is the protocol channel: never log there.
const skillDir = process.env.SAJU_SKILL_DIR;
const pythonBin = process.env.PYTHON_BIN || "python3";
const timeoutMs = Number(process.env.SAJU_ENGINE_TIMEOUT_MS) || 30000;

const personSchema = {
  type: "object",
  properties: {
    date: { type: "string", description: "YYYY-MM-DD" },
    time: { type: "string", description: "HH:MM or 모름" },
    gender: { type: "string", enum: ["남", "여"] },
    region: { type: "string", description: "birth city, e.g. 서울" },
    calendar: { type: "string", enum: ["solar", "lunar"] },
    leap: { type: "boolean", description: "lunar leap month; only with calendar lunar" },
    sewoonYear: { type: "integer", minimum: 1900, maximum: 2100 },
  },
  required: ["date", "gender"],
};

const TOOL = {
  name: "saju_calc",
  description: "Compute saju (four pillars) data for a person, optionally with a partner for compatibility.",
  inputSchema: {
    ...personSchema,
    properties: { ...personSchema.properties, partner: personSchema },
  },
};

const server = new Server({ name: "saju", version: "0.1.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [TOOL] }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== TOOL.name) {
    return { content: [{ type: "text", text: JSON.stringify({ error: "알 수 없는 도구입니다." }) }], isError: true };
  }
  const r = await runSajuCalc(request.params.arguments ?? {}, { pythonBin, skillDir, timeoutMs });
  if (r.ok) return { content: [{ type: "text", text: JSON.stringify(r.result) }] };
  return { content: [{ type: "text", text: JSON.stringify({ error: r.error }) }], isError: true };
});

await server.connect(new StdioServerTransport());
