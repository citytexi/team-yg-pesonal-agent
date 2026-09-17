import { splitMessage } from "./message-split.js";

const THREAD_NAME_LIMIT = 80;
// Discord measures the name in UTF-16 code units, so an emoji costs two.
const DISCORD_THREAD_NAME_LIMIT = 100;
const RESUME_NOTICE = "이전 맥락이 끊겨 새로 시작합니다.";
export const THINKING = "찾는 중입니다. 30초에서 2분 걸립니다.";

const REJECTIONS = {
  daily: "오늘 질문 한도를 다 썼습니다. 내일 다시 물어봐 주세요.",
  user: "질문이 너무 빠릅니다. 잠시 뒤에 다시 물어봐 주세요.",
  concurrent: "지금 처리 중인 질문이 많습니다. 잠시 뒤에 다시 물어봐 주세요.",
};

const FAILURES = {
  timeout: "시간이 초과됐습니다. 질문을 좁혀서 다시 물어봐 주세요.",
  exit: "답변을 만들지 못했습니다. 잠시 뒤에 다시 물어봐 주세요.",
  parse: "답변을 읽지 못했습니다. 잠시 뒤에 다시 물어봐 주세요.",
  error: "답변 도중 문제가 생겼습니다. 잠시 뒤에 다시 물어봐 주세요.",
  empty: "답변이 비어 있었습니다. 질문을 바꿔서 다시 물어봐 주세요.",
};

const FALLBACK_FAILURE = "답변에 실패했습니다. 잠시 뒤에 다시 물어봐 주세요.";
const FALLBACK_REJECTION = "지금은 질문을 받을 수 없습니다. 잠시 뒤에 다시 물어봐 주세요.";

export function threadName(question) {
  const flat = question.replace(/\s+/g, " ").trim();
  if (flat.length === 0) return "위키 질문";

  // Array.from splits on code points, so a surrogate pair never breaks in half.
  let points = Array.from(flat).slice(0, THREAD_NAME_LIMIT);
  while (points.join("").length > DISCORD_THREAD_NAME_LIMIT) points.pop();
  return points.join("");
}

export function rejectionText(reason) {
  return REJECTIONS[reason] ?? FALLBACK_REJECTION;
}

export function failureText(reason) {
  return FAILURES[reason] ?? FALLBACK_FAILURE;
}

export function answerMessages(text, { resumeFailed = false } = {}) {
  const body = resumeFailed ? `${RESUME_NOTICE}\n\n${text}` : text;
  const messages = splitMessage(body, 2000);
  // An empty array would leave the thread silent forever.
  return messages.length > 0 ? messages : [FAILURES.empty];
}
