const CLOSING_FENCE_COST = 4; // "\n```"

function fenceCosts(openFenceLang) {
  if (openFenceLang === null) return { header: 0, footer: 0 };
  return { header: ("```" + openFenceLang).length + 1, footer: CLOSING_FENCE_COST };
}

// Iterating the string yields code points, so a surrogate pair never breaks in
// half the way line.slice(i, i + max) breaks it.
function hardWrap(line, max) {
  if (line.length <= max) return [line];
  const parts = [];
  let current = "";
  for (const character of line) {
    if (current.length + character.length > max) {
      parts.push(current);
      current = "";
    }
    current += character;
  }
  if (current.length > 0) parts.push(current);
  return parts;
}

export function splitMessage(text, limit = 2000) {
  if (text.length === 0) return [];
  if (text.length <= limit) return [text];

  const chunks = [];
  let current = [];
  let currentLength = 0;
  let openFenceLang = null;

  const startChunk = () => {
    current = openFenceLang === null ? [] : ["```" + openFenceLang];
    currentLength = current.length === 0 ? 0 : current[0].length + 1;
  };

  const flush = () => {
    if (current.length === 0) return;
    const body = openFenceLang === null ? current.join("\n") : current.join("\n") + "\n```";
    if (body.trim().length > 0) chunks.push(body);
    startChunk();
  };

  for (const rawLine of text.split("\n")) {
    const { header, footer } = fenceCosts(openFenceLang);
    // A line that opens a fence lands in the current chunk and forces a closing
    // fence onto it, so reserve that cost before deciding where the chunk ends.
    const opensFence = openFenceLang === null && /^```(\S*)/.test(rawLine);
    const reserved = opensFence ? CLOSING_FENCE_COST : footer;
    const wrapWidth = Math.max(1, limit - header - reserved);
    const budget = limit - reserved;

    for (const line of hardWrap(rawLine, wrapWidth)) {
      if (currentLength + line.length + 1 > budget && current.length > 0) flush();
      current.push(line);
      currentLength += line.length + 1;

      const fence = line.match(/^```(\S*)/);
      if (fence) openFenceLang = openFenceLang === null ? fence[1] : null;
    }
  }

  if (current.length > 0) {
    const tail = openFenceLang === null ? current.join("\n") : current.join("\n") + "\n```";
    if (tail.trim().length > 0) chunks.push(tail);
  }
  return chunks;
}
