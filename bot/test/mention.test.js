import { test } from "node:test";
import assert from "node:assert/strict";
import { mentionsBot, stripBotMention } from "../src/mention.js";

const BOT = "111222333";

test("본문에 봇 멘션이 있으면 참이다", () => {
  assert.equal(mentionsBot(`<@${BOT}> G-001 인셋 몇이야`, BOT), true);
  assert.equal(mentionsBot(`그럼 C-102는? <@${BOT}>`, BOT), true);
});

test("닉네임 멘션 형식도 받는다", () => {
  assert.equal(mentionsBot(`<@!${BOT}> 질문`, BOT), true);
});

test("멘션이 없으면 거짓이다", () => {
  assert.equal(mentionsBot("그럼 C-102는?", BOT), false);
  assert.equal(mentionsBot("", BOT), false);
});

test("다른 사람만 멘션하면 거짓이다", () => {
  assert.equal(mentionsBot("<@999888777> 이거 봐줘", BOT), false);
});

test("ID가 앞부분만 겹치는 멘션은 봇 멘션이 아니다", () => {
  assert.equal(mentionsBot(`<@${BOT}0> 질문`, BOT), false);
  assert.equal(mentionsBot(`<@9${BOT}> 질문`, BOT), false);
});

test("역할 멘션과 everyone 은 봇 멘션이 아니다", () => {
  assert.equal(mentionsBot(`<@&${BOT}> 질문`, BOT), false);
  assert.equal(mentionsBot("@everyone 질문", BOT), false);
});

test("봇 멘션만 지우고 다른 사람 멘션은 남긴다", () => {
  assert.equal(
    stripBotMention(`<@${BOT}>  <@999888777> 이 사람이 쓴   정책 <@!${BOT}>`, BOT),
    "<@999888777> 이 사람이 쓴 정책",
  );
});

test("멘션뿐인 본문은 빈 문자열이 된다", () => {
  assert.equal(stripBotMention(`<@${BOT}>`, BOT), "");
});
