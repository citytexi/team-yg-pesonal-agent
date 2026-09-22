import { test } from "node:test";
import assert from "node:assert/strict";
import {
  figmaThreadName,
  figmaFailureText,
  reportMessages,
  summaryMessages,
} from "../src/replies.js";

test("쓰레드 이름에 KST 날짜를 박는다", () => {
  // 2026-09-22 00:30 KST = 2026-09-21 15:30 UTC. 로컬 시간대에 끌려가면 안 된다.
  const at = new Date("2026-09-21T15:30:00Z");
  assert.equal(figmaThreadName(at), "Figma 코멘트 리포트 2026-09-22");
});

test("실패 사유마다 다른 문구를 쓴다", () => {
  const reasons = ["missing-token", "no-files", "exit", "timeout", "empty"];
  const texts = reasons.map(figmaFailureText);
  assert.equal(new Set(texts).size, reasons.length);
  for (const text of texts) assert.ok(text.length > 0);
});

test("설정이 빠진 두 사유는 설정 문제임을 알린다", () => {
  assert.match(figmaFailureText("missing-token"), /FIGMA_TOKEN/);
  assert.match(figmaFailureText("no-files"), /FIGMA_FILES/);
});

test("모르는 사유에도 문구가 있다", () => {
  assert.ok(figmaFailureText("한 번도 본 적 없는 사유").length > 0);
});

test("리포트 원문에 아무것도 덧붙이지 않는다", () => {
  assert.deepEqual(reportMessages("리포트 본문"), ["리포트 본문"]);
});

test("긴 리포트는 2000자 단위로 쪼갠다", () => {
  const messages = reportMessages("가".repeat(5000));
  assert.ok(messages.length > 1);
  for (const message of messages) assert.ok(message.length <= 2000);
  assert.equal(messages.join(""), "가".repeat(5000));
});

test("요약에는 그것이 봇의 판단임을 밝히는 머리말을 단다", () => {
  const messages = summaryMessages("항목 1");
  assert.match(messages[0], /개발 필요 항목/);
  assert.ok(messages[0].includes("항목 1"));
});

test("긴 요약도 2000자 단위로 쪼갠다", () => {
  const messages = summaryMessages("나".repeat(5000));
  for (const message of messages) assert.ok(message.length <= 2000);
});
