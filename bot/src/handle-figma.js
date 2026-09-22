import {
  rejectionText,
  figmaFailureText,
  reportMessages,
  summaryMessages,
  SUMMARY_FAILED,
} from "./replies.js";

// 리포트는 명령 인자로 claude 에 넘어간다. macOS 의 인자 길이 상한에 걸리면
// 프로세스가 아예 뜨지 않으므로, 넘기기 전에 여기서 자른다. 게시되는 원문은
// 자르지 않는다 — "요약하거나 가공하지 않는다"는 요구가 걸린 쪽은 원문이다.
export const MAX_SUMMARY_INPUT = 60000;

const SUMMARY_DIRECTIVE =
  "너는 Figma 코멘트 리포트를 읽고 개발이 필요한 항목만 추리는 일을 한다. " +
  "도구를 쓰지 말고 주어진 본문만 근거로 삼아라. 저장소 문서를 뒤지지 마라.";

const SUMMARY_QUESTION =
  "아래는 Figma 코멘트 리포트 원문이다. 이 내용을 근거로 개발이 필요한 항목을 추려서 " +
  "짧은 목록으로 적어라. 각 항목은 한 줄로 쓰고, 어느 코멘트에서 나온 것인지 밝혀라. " +
  "개발이 필요한 항목이 없으면 없다고만 적어라. 리포트를 다시 옮겨 적지 마라.\n\n";

function summaryInput(report) {
  if (report.length <= MAX_SUMMARY_INPUT) return report;
  return `${report.slice(0, MAX_SUMMARY_INPUT)}\n\n(이하 생략됨)`;
}

export function createFigmaHandler({ limiter, reportRunner, runner, randomUUID, log }) {
  return async function handle({ userId, resolveThread, replyDirect }) {
    const slot = limiter.acquire(userId);
    if (!slot.ok) {
      await replyDirect(rejectionText(slot.reason));
      return { status: "rejected", reason: slot.reason };
    }

    try {
      const { threadId, postMessages } = await resolveThread();

      const report = await reportRunner.run();
      if (!report.ok) {
        log("figma report failed", { threadId, reason: report.reason, detail: report.detail });
        await postMessages([figmaFailureText(report.reason)]);
        return { status: "failed", reason: report.reason };
      }

      // 원문을 먼저 내보낸다. 요약이 실패해도 리포트는 손에 남아야 한다.
      await postMessages(reportMessages(report.text));

      const summary = await runner.ask({
        question: SUMMARY_QUESTION + summaryInput(report.text),
        sessionId: randomUUID(),
        resume: false,
        systemPrompt: SUMMARY_DIRECTIVE,
      });

      if (!summary.ok) {
        log("figma summary failed", { threadId, reason: summary.reason, detail: summary.detail });
        await postMessages([SUMMARY_FAILED]);
        return { status: "reported" };
      }

      await postMessages(summaryMessages(summary.text));
      return { status: "reported" };
    } catch (error) {
      // 쓰레드를 열거나 거기에 쓰는 데 실패했다. 알릴 곳이 없으니 기록만 남긴다.
      log("could not deliver figma report", { userId, detail: error?.message });
      return { status: "failed", reason: "delivery" };
    } finally {
      slot.release();
    }
  };
}
