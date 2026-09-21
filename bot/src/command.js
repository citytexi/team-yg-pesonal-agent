// 본문 전체가 명령어와 정확히 같을 때만 명령으로 읽는다. 앞머리만 보고 가르면
// "figma 코멘트 정책이 뭐야" 같은 진짜 질문이 리포트 실행으로 새어 나간다.
const FIGMA_COMMAND = /^\/?figma$/i;

export function parseCommand(text) {
  const flat = text.trim();
  if (FIGMA_COMMAND.test(flat)) return { kind: "figma" };
  return { kind: "question", question: flat };
}
