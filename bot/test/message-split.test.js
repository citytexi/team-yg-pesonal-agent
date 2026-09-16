import { test } from "node:test";
import assert from "node:assert/strict";
import { splitMessage } from "../src/message-split.js";

test("한도 이하는 그대로 한 조각이다", () => {
  assert.deepEqual(splitMessage("짧은 답변", 2000), ["짧은 답변"]);
});

test("정확히 한도 길이는 나누지 않는다", () => {
  const text = "가".repeat(2000);
  assert.deepEqual(splitMessage(text, 2000), [text]);
});

test("한도를 넘으면 나눈다", () => {
  const text = ("가".repeat(99) + "\n").repeat(30);
  const chunks = splitMessage(text, 2000);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) assert.ok(chunk.length <= 2000);
});

test("줄 경계에서 나눈다", () => {
  const lines = Array.from({ length: 10 }, (_, i) => `line${i}`.padEnd(30, "-"));
  const chunks = splitMessage(lines.join("\n"), 100);
  for (const chunk of chunks) {
    for (const line of chunk.split("\n")) {
      assert.ok(/^line\d-+$/.test(line), `잘린 줄: ${line}`);
    }
  }
});

test("코드 펜스가 걸치면 닫고 다시 연다", () => {
  const body = Array.from({ length: 10 }, (_, i) => `const x${i} = ${i};`).join("\n");
  const text = "설명\n\n```js\n" + body + "\n```";
  const chunks = splitMessage(text, 80);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    const fences = (chunk.match(/^```/gm) || []).length;
    assert.equal(fences % 2, 0, `펜스가 홀수인 조각: ${chunk}`);
  }
  assert.ok(chunks[1].startsWith("```js"), "뒤 조각이 같은 언어로 다시 열려야 한다");
});

test("개행 없는 긴 한 줄도 한도를 지킨다", () => {
  const chunks = splitMessage("a".repeat(5000), 2000);
  for (const chunk of chunks) assert.ok(chunk.length <= 2000);
  assert.equal(chunks.join("").replace(/\n/g, "").length, 5000);
});

test("빈 문자열은 빈 배열이다", () => {
  assert.deepEqual(splitMessage("", 2000), []);
});
