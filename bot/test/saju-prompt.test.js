import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSajuPrompt } from "../src/saju-prompt.js";
import { PERSONA_DIRECTIVE } from "../src/claude-runner.js";
import { MEME_DIRECTIVE } from "../src/memes.js";

function fakeReader(files, calls = []) {
  return (path) => {
    calls.push(path);
    for (const [suffix, content] of Object.entries(files)) {
      if (path.endsWith(suffix)) return content;
    }
    throw new Error(`ENOENT: ${path}`);
  };
}

const FILES = {
  "SKILL.md": "SKILL-BODY",
  "references/input-normalization.md": "NORMALIZE-BODY",
  "references/output-template.md": "TEMPLATE-BODY",
};

test("지시문과 세 문서가 머리줄과 함께 이어진다", () => {
  const prompt = loadSajuPrompt("/skill", fakeReader(FILES));
  assert.ok(prompt.includes("saju_calc"));
  for (const body of ["SKILL-BODY", "NORMALIZE-BODY", "TEMPLATE-BODY"]) {
    assert.ok(prompt.includes(body), `${body} 가 없다`);
  }
  assert.ok(prompt.includes("--- SKILL.md ---"));
  assert.ok(prompt.includes("--- references/input-normalization.md ---"));
  assert.ok(prompt.includes("--- references/output-template.md ---"));
});

test("reference-data 는 읽지 않는다", () => {
  const calls = [];
  loadSajuPrompt("/skill", fakeReader(FILES, calls));
  assert.equal(calls.length, 3);
  assert.ok(calls.every((path) => !path.includes("reference-data")));
});

test("페르소나·밈·ask 스킬 지시가 들어가지 않는다", () => {
  const prompt = loadSajuPrompt("/skill", fakeReader(FILES));
  assert.ok(!prompt.includes(PERSONA_DIRECTIVE.split("\n")[0]));
  assert.ok(!prompt.includes(MEME_DIRECTIVE.split("\n")[0]));
  assert.ok(!prompt.includes("ask"));
});

test("파일 하나가 없으면 throw 한다", () => {
  const { "references/output-template.md": _omitted, ...partial } = FILES;
  assert.throws(() => loadSajuPrompt("/skill", fakeReader(partial)));
});
