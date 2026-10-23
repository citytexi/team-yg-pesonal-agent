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

test("!사주 만 보내면 입력이 빈 사주 명령이다", () => {
  assert.deepEqual(parseCommand("!사주"), { kind: "saju", input: "" });
});

test("!사주 뒤 내용은 입력으로 넘긴다", () => {
  assert.deepEqual(parseCommand("  !사주 1990-05-15 07:30 남 서울 "), { kind: "saju", input: "1990-05-15 07:30 남 서울" });
});

test("!사주 가 중간에 있으면 질문이다", () => {
  assert.equal(parseCommand("이거 !사주 명령 맞아?").kind, "question");
});

test("!사주 에 바로 글자가 붙으면 명령이 아니다", () => {
  assert.equal(parseCommand("!사주팔자").kind, "question");
});
