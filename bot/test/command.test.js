import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCommand } from "../src/command.js";

test("figma 한 단어는 리포트 명령이다", () => {
  assert.deepEqual(parseCommand("figma"), { kind: "figma" });
});

test("슬래시를 붙여도 리포트 명령이다", () => {
  assert.deepEqual(parseCommand("/figma"), { kind: "figma" });
});

test("대소문자와 앞뒤 공백을 가리지 않는다", () => {
  assert.deepEqual(parseCommand("  FIGMA  "), { kind: "figma" });
});

test("figma 로 시작하는 질문은 명령으로 가로채지 않는다", () => {
  assert.deepEqual(parseCommand("figma 코멘트 정책이 뭐야"), {
    kind: "question",
    question: "figma 코멘트 정책이 뭐야",
  });
});

test("그 밖의 본문은 질문이다", () => {
  assert.deepEqual(parseCommand("G-001 배치 규칙 알려줘"), {
    kind: "question",
    question: "G-001 배치 규칙 알려줘",
  });
});

test("질문 본문의 앞뒤 공백을 없앤다", () => {
  assert.deepEqual(parseCommand("  질문  "), { kind: "question", question: "질문" });
});
