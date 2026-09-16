import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function readAll(filePath) {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    return {};
  } catch {
    return {};
  }
}

export function createSessionStore({ filePath, now = () => Date.now(), ttlMs = WEEK_MS }) {
  let entries = readAll(filePath);

  const persist = () => {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(entries, null, 2), "utf8");
  };

  return {
    get(threadId) {
      const entry = entries[threadId];
      if (!entry || typeof entry.sessionId !== "string") return null;
      if (now() - entry.updatedAt > ttlMs) {
        delete entries[threadId];
        persist();
        return null;
      }
      return entry.sessionId;
    },

    set(threadId, sessionId) {
      entries[threadId] = { sessionId, updatedAt: now() };
      persist();
    },

    remove(threadId) {
      delete entries[threadId];
      persist();
    },
  };
}
