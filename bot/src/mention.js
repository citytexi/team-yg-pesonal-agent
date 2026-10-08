// The bot answers only when its mention is typed into the message body.
// message.mentions.users is not used for this: Discord also puts the bot there
// when someone replies to one of its messages with the reply ping on, and that
// made the bot answer every message of a conversation held in its thread.
// <@&id> is a role mention and never matches.
function selfMention(botId) {
  return new RegExp(`<@!?${botId}>`, "g");
}

export function mentionsBot(content, botId) {
  return selfMention(botId).test(content);
}

// Strip only our own mention. A blanket /<@!?\d+>/g also deletes the people
// the question is about, and "이 사람이 쓴 정책" loses its referent.
export function stripBotMention(content, botId) {
  return content.replace(selfMention(botId), " ").replace(/\s+/g, " ").trim();
}
