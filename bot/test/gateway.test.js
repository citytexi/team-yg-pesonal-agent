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
function fakeMessage({ content, inThread = false, ownThread = false, repliedToBot = false, authorIsBot = false }) {
  return {
    author: { bot: authorIsBot, id: "user-1" },
    guildId: "guild-1",
    content,
    mentions: { users: new Map(repliedToBot ? [[BOT, {}]] : []) },
    channel: {
      id: inThread ? "thread-1" : "channel-1",
      parentId: inThread ? "channel-1" : null,
      ownerId: ownThread ? BOT : "user-1",
      isThread: () => inThread,
    },
  };
}

async function deliver(message) {
  const questions = [];
  const client = fakeClient();
  await startGateway({
    config,
    client,
    log: () => {},
    handle: async ({ question }) => questions.push(question),
    handleFigma: async () => questions.push("figma"),
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
