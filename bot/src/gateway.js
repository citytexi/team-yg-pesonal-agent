import { Client, GatewayIntentBits, Events, ChannelType } from "discord.js";
import { threadName, THINKING, figmaThreadName, FIGMA_RUNNING } from "./replies.js";
import { parseCommand } from "./command.js";

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

export async function startGateway({ config, handle, handleFigma, client, log = console.log }) {
  client.on(Events.MessageCreate, async (message) => {
    try {
      if (message.author.bot) return;
      if (message.guildId !== config.guildId) return;
      if (!isAllowedChannel(message, config)) return;

      const inThread = message.channel.isThread();
      const mentioned = message.mentions.users.has(client.user.id);
      const ownThread = inThread && message.channel.ownerId === client.user.id;
      if (!mentioned && !ownThread) return;

      // Strip only our own mention. A blanket /<@!?\d+>/g also deletes the
      // people the question is about, and "이 사람이 쓴 정책" loses its referent.
      const selfMention = new RegExp(`<@!?${client.user.id}>`, "g");
      const body = message.content.replace(selfMention, " ").replace(/\s+/g, " ").trim();
      if (body.length === 0) return;

      const command = parseCommand(body);

      const resolveThreadAs = ({ name, waiting }) => async () => {
        const thread = inThread
          ? message.channel
          : await message.startThread({
              name,
              type: ChannelType.PublicThread,
            });

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

      const replyDirect = (text) => message.reply({ content: text, ...SILENT });

      if (command.kind === "figma") {
        await handleFigma({
          userId: message.author.id,
          resolveThread: resolveThreadAs({ name: figmaThreadName(), waiting: FIGMA_RUNNING }),
          replyDirect,
        });
        return;
      }

      await handle({
        userId: message.author.id,
        question: command.question,
        resolveThread: resolveThreadAs({
          name: threadName(command.question),
          waiting: THINKING,
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
