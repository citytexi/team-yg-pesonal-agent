// 본문 전체가 명령어와 정확히 같을 때만 명령으로 읽는다. 앞머리만 보고 가르면
// "figma 코멘트 정책이 뭐야" 같은 진짜 질문이 리포트 실행으로 새어 나간다.
const FIGMA_COMMAND = /^\/?figma$/i;
// 명령어 뒤에 글자가 붙으면(!사주팔자) 명령이 아니다. 공백 뒤 내용만 입력으로 받는다.
const SAJU_COMMAND = /^!사주(?:\s+([\s\S]*))?$/;

export function parseCommand(text) {
  const flat = text.trim();
  if (FIGMA_COMMAND.test(flat)) return { kind: "figma" };
  const saju = SAJU_COMMAND.exec(flat);
  if (saju) return { kind: "saju", input: (saju[1] ?? "").trim() };
  return { kind: "question", question: flat };
}
