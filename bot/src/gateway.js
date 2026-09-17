import { Client, GatewayIntentBits, Events, ChannelType } from "discord.js";
import { threadName } from "./replies.js";

const THINKING = "찾는 중입니다. 30초에서 2분 걸립니다.";

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

export async function startGateway({ config, handle, client, log = console.log }) {
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
      const question = message.content.replace(selfMention, " ").replace(/\s+/g, " ").trim();
      if (question.length === 0) return;

      const resolveThread = async () => {
        const thread = inThread
          ? message.channel
          : await message.startThread({
              name: threadName(question),
              type: ChannelType.PublicThread,
            });

        await thread.sendTyping();
        const placeholder = await thread.send(THINKING);
        let first = true;

        return {
          threadId: thread.id,
          postMessages: async (messages) => {
            for (const text of messages) {
              if (first) {
                await placeholder.edit(text);
                first = false;
              } else {
                await thread.send(text);
              }
            }
          },
        };
      };

      await handle({
        userId: message.author.id,
        question,
        resolveThread,
        replyDirect: (text) => message.reply(text),
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
