import { rejectionText, failureText, answerMessages } from "./replies.js";

const RETRYABLE_ON_RESUME = "exit";

export function createQuestionHandler({ store, limiter, runner, randomUUID, log }) {
  return async function handle({ userId, question, resolveThread, replyDirect }) {
    const slot = limiter.acquire(userId);
    if (!slot.ok) {
      await replyDirect(rejectionText(slot.reason));
      return { status: "rejected", reason: slot.reason };
    }

    try {
      const { threadId, postMessages } = await resolveThread();

      const existing = store.get(threadId);
      const resume = existing !== null;
      const sessionId = existing ?? randomUUID();

      let result = await runner.ask({ question, sessionId, resume });
      let resumeFailed = false;

      if (!result.ok && result.reason === "timeout") {
        store.remove(threadId);
        log("claude timed out", { threadId, detail: result.detail });
        await postMessages([failureText(result.reason)]);
        return { status: "failed", reason: result.reason };
      }

      if (!result.ok && resume && result.reason === RETRYABLE_ON_RESUME) {
        log("resume failed, starting a new session", { threadId, detail: result.detail });
        store.remove(threadId);
        resumeFailed = true;
        result = await runner.ask({ question, sessionId: randomUUID(), resume: false });
      }

      if (!result.ok) {
        log("claude failed", { threadId, reason: result.reason, detail: result.detail });
        await postMessages([failureText(result.reason)]);
        return { status: "failed", reason: result.reason };
      }

      // Deliver first. A failed write costs the next follow-up its context; a
      // failed delivery costs the answer itself.
      await postMessages(answerMessages(result.text, { resumeFailed }));
      try {
        store.set(threadId, result.sessionId);
      } catch (error) {
        log("could not persist session", { threadId, detail: error?.message });
      }
      return { status: "answered" };
    } catch (error) {
      // Opening the thread or posting to it failed, so there is nowhere to
      // report this. Log it and let the caller move on.
      log("could not deliver", { userId, detail: error?.message });
      return { status: "failed", reason: "delivery" };
    } finally {
      slot.release();
    }
  };
}
