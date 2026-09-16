const FENCE_RESERVE = 8;

function hardWrap(line, max) {
  if (line.length <= max) return [line];
  const parts = [];
  for (let i = 0; i < line.length; i += max) parts.push(line.slice(i, i + max));
  return parts;
}

export function splitMessage(text, limit = 2000) {
  if (text.length === 0) return [];
  if (text.length <= limit) return [text];

  const budget = limit - FENCE_RESERVE;
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
    for (const line of hardWrap(rawLine, budget)) {
      if (currentLength + line.length + 1 > budget && current.length > 0) flush();
      current.push(line);
      currentLength += line.length + 1;

      const fence = line.match(/^```(\S*)/);
      if (fence) openFenceLang = openFenceLang === null ? fence[1] : null;
    }
  }

  const tail = current.join("\n");
  if (tail.trim().length > 0) chunks.push(tail);
  return chunks;
}
