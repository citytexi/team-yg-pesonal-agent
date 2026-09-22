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

export const FIGMA_RUNNING = "Figma 코멘트를 모으는 중입니다. 1분에서 2분 걸립니다.";
const SUMMARY_HEADING = "**개발 필요 항목 (봇이 리포트를 읽고 추린 것입니다)**";
export const SUMMARY_FAILED = "리포트는 위에 그대로 있습니다. 개발 필요 항목 요약만 실패했습니다.";

const FIGMA_FAILURES = {
  "missing-token": "FIGMA_TOKEN 이 설정돼 있지 않아 리포트를 만들지 못했습니다.",
  "no-files": "FIGMA_FILES 에 조회할 파일이 없어 리포트를 만들지 못했습니다.",
  exit: "Figma 조회가 실패했습니다. 토큰이 만료됐거나 파일 접근 권한이 없을 수 있습니다.",
  timeout: "Figma 조회가 시간 안에 끝나지 않았습니다. 잠시 뒤에 다시 시도해 주세요.",
  empty: "리포트가 비어 있었습니다. 조건에 맞는 코멘트가 없었을 수 있습니다.",
};

const FALLBACK_FIGMA_FAILURE = "리포트를 만들지 못했습니다. 잠시 뒤에 다시 시도해 주세요.";

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

// 날짜는 기계의 시간대가 아니라 KST 로 찍는다. 리포트 자체가 KST 기준이라
// 둘이 어긋나면 어제 리포트가 오늘 이름을 달고 올라온다.
export function figmaThreadName(at = new Date()) {
  const kst = new Date(at.getTime() + 9 * 60 * 60 * 1000);
  return `Figma 코멘트 리포트 ${kst.toISOString().slice(0, 10)}`;
}

export function figmaFailureText(reason) {
  return FIGMA_FAILURES[reason] ?? FALLBACK_FIGMA_FAILURE;
}

// 원문은 손대지 않는다. 머리말도 꼬리말도 붙이지 않는 것이 이 함수의 일이다.
export function reportMessages(text) {
  const messages = splitMessage(text, 2000);
  return messages.length > 0 ? messages : [FIGMA_FAILURES.empty];
}

export function summaryMessages(text) {
  return splitMessage(`${SUMMARY_HEADING}\n\n${text}`, 2000);
}
