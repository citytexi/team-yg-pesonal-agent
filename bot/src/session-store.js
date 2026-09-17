import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// One store per process. The store keeps every entry in memory and rewrites the
// whole file on each write, so two stores sharing a file silently drop each
// other's entries. The bot creates exactly one in src/index.js.
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
      // A missing timestamp makes every comparison NaN, which reads as "never
      // expired" and pins the entry in the file forever.
      if (typeof entry.updatedAt !== "number") {
        delete entries[threadId];
        persist();
        return null;
      }
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
