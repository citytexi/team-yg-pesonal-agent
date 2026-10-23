import { Client, GatewayIntentBits, Events, ChannelType } from "discord.js";
import {
  threadName,
  THINKING,
  figmaThreadName,
  FIGMA_RUNNING,
  SAJU_THREAD_PREFIX,
  SAJU_THINKING,
  SAJU_EMPTY_INPUT,
  sajuThreadName,
  sajuMovedText,
} from "./replies.js";
import { parseCommand } from "./command.js";
import { mentionsBot, stripBotMention } from "./mention.js";

// Every user-facing string lives in replies.js. Nothing in this file writes one.
const SILENT = { allowedMentions: { parse: [] } };

function isAllowedChannel(message, config) {
  const parentId = message.channel.isThread() ? message.channel.parentId : message.channel.id;
  return config.allowedChannelIds.includes(parentId);
}

export function createClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });
}

export async function startGateway({ config, handle, handleFigma, handleSaju, client, log = console.log }) {
  client.on(Events.MessageCreate, async (message) => {
    try {
      if (message.author.bot) return;
      if (message.guildId !== config.guildId) return;
      if (!isAllowedChannel(message, config)) return;

      // Mention only, in our own thread too. Answering every message there made
      // the bot reply to a whole conversation it was not part of.
      if (!mentionsBot(message.content, client.user.id)) return;

      const inThread = message.channel.isThread();
      const body = stripBotMention(message.content, client.user.id);
      if (body.length === 0) return;

      const command = parseCommand(body);

      // `getThread` runs only when the handler calls resolveThread, i.e. after
      // the limiter accepted the request. A rejected request opens nothing.
      const resolveThreadAs = ({ waiting, getThread }) => async () => {
        const thread = await getThread();

        await thread.sendTyping();
        const placeholder = await thread.send({ content: waiting, ...SILENT });
        let first = true;

        return {
          threadId: thread.id,
          // Answers quote the wiki, which can contain <@id> shaped text. Without
          // allowedMentions that text pings real people.
          postMessages: async (messages) => {
            for (const text of messages) {
              if (first) {
                await placeholder.edit({ content: text, ...SILENT });
                first = false;
              } else {
                await thread.send({ content: text, ...SILENT });
              }
            }
          },
        };
      };

      const startThreadAs = (name) => () =>
        inThread
          ? message.channel
          : message.startThread({ name, type: ChannelType.PublicThread });

      const replyDirect = (text) => message.reply({ content: text, ...SILENT });

      const sajuArgs = (input, getThread) => ({
        userId: message.author.id,
        question: input.length > 0 ? input : SAJU_EMPTY_INPUT,
        resolveThread: resolveThreadAs({ waiting: SAJU_THINKING, getThread }),
        replyDirect,
      });

      // Checked before parseCommand: inside a saju thread every body is saju
      // input, including text that would otherwise parse as another command.
      const inOwnSajuThread =
        inThread &&
        message.channel.ownerId === client.user.id &&
        message.channel.name?.startsWith(SAJU_THREAD_PREFIX);
      if (inOwnSajuThread) {
        const input = command.kind === "saju" ? command.input : body;
        await handleSaju(sajuArgs(input, () => message.channel));
        return;
      }

      if (command.kind === "saju") {
        const getThread = inThread
          ? async () => {
              // A saju session must not share a thread with another kind of
              // conversation, so it moves to a fresh thread beside this one.
              const created = await message.channel.parent.threads.create({
                name: sajuThreadName(),
                type: ChannelType.PublicThread,
              });
              await message.reply({ content: sajuMovedText(created.id), ...SILENT });
              return created;
            }
          : startThreadAs(sajuThreadName());
        await handleSaju(sajuArgs(command.input, getThread));
        return;
      }

      if (command.kind === "figma") {
        await handleFigma({
          userId: message.author.id,
          resolveThread: resolveThreadAs({
            waiting: FIGMA_RUNNING,
            getThread: startThreadAs(figmaThreadName()),
          }),
          replyDirect,
        });
        return;
      }

      await handle({
        userId: message.author.id,
        question: command.question,
        resolveThread: resolveThreadAs({
          waiting: THINKING,
          getThread: startThreadAs(threadName(command.question)),
        }),
        replyDirect,
      });
    } catch (error) {
      log("gateway error", error?.message ?? error);
    }
  });

  client.once(Events.ClientReady, (ready) => {
    log(`logged in as ${ready.user.tag}`);
  });

  await client.login(config.discordToken);
}
