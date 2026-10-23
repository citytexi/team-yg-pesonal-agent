import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const server = fileURLToPath(new URL("../src/saju-mcp-server.js", import.meta.url));
const skillDir = fileURLToPath(new URL("./fixtures/fake-saju", import.meta.url));

async function withClient(fn) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [server],
    env: { PATH: process.env.PATH, SAJU_SKILL_DIR: skillDir, PYTHON_BIN: "python3" },
    stderr: "ignore",
  });
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(transport);
  try {
    await fn(client);
  } finally {
    await client.close();
  }
}

test("도구는 saju_calc 하나뿐이다", () =>
  withClient(async (client) => {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name), ["saju_calc"]);
  }));

test("saju_calc가 엔진 인자를 넘긴다", () =>
  withClient(async (client) => {
    const res = await client.callTool({
      name: "saju_calc",
      arguments: { date: "1990-05-15", gender: "남" },
    });
    assert.notEqual(res.isError, true);
    const body = JSON.parse(res.content[0].text);
    const i = body.argv.indexOf("--date");
    assert.equal(body.argv[i + 1], "1990-05-15");
  }));

test("검증 실패는 isError로 돌아온다", () =>
  withClient(async (client) => {
    const res = await client.callTool({
      name: "saju_calc",
      arguments: { date: "1990-05-15", gender: "남", region: "--compat" },
    });
    assert.equal(res.isError, true);
  }));
