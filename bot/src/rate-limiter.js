const MINUTE_MS = 60 * 1000;

function localDayKey(timestamp) {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function createRateLimiter({ maxConcurrent, perUserPerMin, dailyQuota, now = () => Date.now() }) {
  let running = 0;
  let dayKey = localDayKey(now());
  let dailyCount = 0;
  const userHits = new Map();

  return {
    acquire(userId) {
      const at = now();

      const today = localDayKey(at);
      if (today !== dayKey) {
        dayKey = today;
        dailyCount = 0;
      }
      if (dailyCount >= dailyQuota) return { ok: false, reason: "daily" };

      const hits = (userHits.get(userId) || []).filter((hit) => at - hit < MINUTE_MS);
      if (hits.length >= perUserPerMin) {
        userHits.set(userId, hits);
        return { ok: false, reason: "user" };
      }

      if (running >= maxConcurrent) {
        userHits.set(userId, hits);
        return { ok: false, reason: "concurrent" };
      }

      hits.push(at);
      userHits.set(userId, hits);
      dailyCount += 1;
      running += 1;

      let released = false;
      return {
        ok: true,
        release() {
          if (released) return;
          released = true;
          running -= 1;
        },
      };
    },

    used() {
      return { daily: dailyCount, running };
    },
  };
}
