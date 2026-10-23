import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Events } from "discord.js";
import { startGateway } from "../src/gateway.js";

const BOT = "111222333";
const config = { guildId: "guild-1", allowedChannelIds: ["channel-1"], discordToken: "unused" };

function fakeClient() {
  const client = new EventEmitter();
  client.user = { id: BOT };
  client.login = async () => {};
  return client;
}

// repliedToBot mirrors Discord: replying to the bot with the reply ping on puts
// the bot in mentions.users even though the body carries no mention.
function fakeThread(id) {
  return {
    id,
    sendTyping: async () => {},
    send: async () => ({ edit: async () => {} }),
  };
}

function fakeMessage({
  content,
  inThread = false,
  ownThread = false,
  repliedToBot = false,
  authorIsBot = false,
  name = "일반 스레드",
}) {
  const calls = { startThread: [], create: [], reply: [] };
  const message = {
    calls,
    startThread: async (options) => {
      calls.startThread.push(options);
      return fakeThread("started-1");
    },
    reply: async (options) => {
      calls.reply.push(options);
    },
    author: { bot: authorIsBot, id: "user-1" },
    guildId: "guild-1",
    content,
    mentions: { users: new Map(repliedToBot ? [[BOT, {}]] : []) },
    channel: {
      id: inThread ? "thread-1" : "channel-1",
      parentId: inThread ? "channel-1" : null,
      ownerId: ownThread ? BOT : "user-1",
      name,
      isThread: () => inThread,
      parent: {
        threads: {
          create: async (options) => {
            calls.create.push(options);
            return fakeThread("created-1");
          },
        },
      },
    },
  };
  return message;
}

// By default handleSaju opens the thread like the real one does after the limiter.
async function deliver(message, { openThread = true } = {}) {
  const questions = [];
  const client = fakeClient();
  await startGateway({
    config,
    client,
    log: () => {},
    handle: async ({ question }) => questions.push(question),
    handleFigma: async () => questions.push("figma"),
    handleSaju: async ({ question, resolveThread }) => {
      questions.push(`saju:${question}`);
      if (openThread) await resolveThread();
    },
  });
  const [listener] = client.listeners(Events.MessageCreate);
  await listener(message);
  return questions;
}

test("채널에서 봇을 멘션하면 질문을 넘긴다", async () => {
  assert.deepEqual(await deliver(fakeMessage({ content: `<@${BOT}> G-001 인셋 몇이야` })), ["G-001 인셋 몇이야"]);
});

test("봇이 만든 스레드라도 멘션이 없으면 반응하지 않는다", async () => {
  assert.deepEqual(
    await deliver(fakeMessage({ content: "그럼 C-102는?", inThread: true, ownThread: true })),
    [],
  );
});

test("봇이 만든 스레드에서 멘션하면 되물음을 넘긴다", async () => {
  assert.deepEqual(
    await deliver(fakeMessage({ content: `<@${BOT}> 그럼 C-102는?`, inThread: true, ownThread: true })),
    ["그럼 C-102는?"],
  );
});

test("봇 메시지에 답장만 하고 본문에 멘션이 없으면 반응하지 않는다", async () => {
  assert.deepEqual(
    await deliver(fakeMessage({ content: "그럼 C-102는?", inThread: true, ownThread: true, repliedToBot: true })),
    [],
  );
});

test("봇이 쓴 메시지는 멘션이 있어도 반응하지 않는다", async () => {
  assert.deepEqual(await deliver(fakeMessage({ content: `<@${BOT}> 질문`, authorIsBot: true })), []);
});

test("멘션뿐인 메시지에는 반응하지 않는다", async () => {
  assert.deepEqual(await deliver(fakeMessage({ content: `<@${BOT}>` })), []);
});

const SAJU_NAME = "🔮 사주 2026-10-23";

test("채널의 !사주는 사주 핸들러와 새 스레드로 간다", async () => {
  const message = fakeMessage({ content: `<@${BOT}> !사주 1990-05-15 남` });
  assert.deepEqual(await deliver(message), ["saju:1990-05-15 남"]);
  assert.equal(message.calls.startThread.length, 1);
  assert.ok(message.calls.startThread[0].name.startsWith("🔮 사주"));
  assert.ok(!message.calls.startThread[0].name.includes("1990"));
});

test("입력이 빈 !사주는 입력 폼 요청을 넘긴다", async () => {
  assert.deepEqual(await deliver(fakeMessage({ content: `<@${BOT}> !사주` })), [
    "saju:사주를 보려고 해. 입력 폼을 보여 줘.",
  ]);
});

test("봇 소유 사주 스레드에서는 본문 전체가 사주 핸들러로 간다", async () => {
  const message = fakeMessage({
    content: `<@${BOT}> 07:30 서울`,
    inThread: true,
    ownThread: true,
    name: SAJU_NAME,
  });
  assert.deepEqual(await deliver(message), ["saju:07:30 서울"]);
  assert.equal(message.calls.create.length, 0);
});

test("사주 스레드에서 !사주를 붙여도 접두어를 뗀다", async () => {
  const message = fakeMessage({
    content: `<@${BOT}> !사주 07:30`,
    inThread: true,
    ownThread: true,
    name: SAJU_NAME,
  });
  assert.deepEqual(await deliver(message), ["saju:07:30"]);
});

test("사주 스레드에서는 figma도 사주 핸들러로 간다", async () => {
  const message = fakeMessage({
    content: `<@${BOT}> figma`,
    inThread: true,
    ownThread: true,
    name: SAJU_NAME,
  });
  assert.deepEqual(await deliver(message), ["saju:figma"]);
});

test("봇 소유 일반 스레드의 !사주는 새 스레드를 열고 안내한다", async () => {
  const message = fakeMessage({ content: `<@${BOT}> !사주 07:30`, inThread: true, ownThread: true });
  assert.deepEqual(await deliver(message), ["saju:07:30"]);
  assert.equal(message.calls.create.length, 1);
  assert.ok(message.calls.create[0].name.startsWith("🔮 사주"));
  assert.equal(message.calls.reply.length, 1);
  assert.ok(message.calls.reply[0].content.includes("<#"));
});

test("사람 소유 스레드의 !사주도 새 스레드를 연다", async () => {
  const message = fakeMessage({ content: `<@${BOT}> !사주 07:30`, inThread: true });
  assert.deepEqual(await deliver(message), ["saju:07:30"]);
  assert.equal(message.calls.create.length, 1);
  assert.ok(message.calls.reply[0].content.includes("<#"));
});

test("사람 소유 스레드는 이름이 사주여도 일반 질문으로 간다", async () => {
  const message = fakeMessage({ content: `<@${BOT}> 07:30`, inThread: true, name: SAJU_NAME });
  assert.deepEqual(await deliver(message), ["07:30"]);
});

test("한도 거절로 스레드를 열지 않으면 새 스레드도 안내도 없다", async () => {
  const message = fakeMessage({ content: `<@${BOT}> !사주 07:30`, inThread: true });
  assert.deepEqual(await deliver(message, { openThread: false }), ["saju:07:30"]);
  assert.equal(message.calls.create.length, 0);
  assert.equal(message.calls.reply.length, 0);
});
