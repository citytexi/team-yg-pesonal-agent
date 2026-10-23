import { readFileSync } from "node:fs";
import { join } from "node:path";

const SAJU_DIRECTIVE = [
  "디스코드 사주 스레드다. 아래 saju-manseryeok 스킬 문서대로 진행한다.",
  "- 엔진 실행은 saju_calc 도구로 한다. 문서의 `python3 … saju.py` 명령은 이 도구 호출로 대신한다.",
  "- 궁합은 saju_calc 에 partner 를 함께 넘긴다. 결과 JSON 파일을 따로 만들지 않는다.",
  "- 사주와 무관한 질문에는 답하지 않고, 이 스레드는 사주 전용이라고 짧게 안내한다.",
  "- 답변은 디스코드 메시지로 나간다.",
].join("\n");

// reference-data.md is deliberately absent: it is large and only the engine needs it.
const SKILL_FILES = [
  "SKILL.md",
  "references/input-normalization.md",
  "references/output-template.md",
];

// Throws when a file is missing, so a broken skill directory fails at startup
// instead of on the first user message.
export function loadSajuPrompt(skillDir, readFile = readFileSync) {
  const parts = SKILL_FILES.map((relative) => {
    const body = readFile(join(skillDir, relative), "utf8");
    return `--- ${relative} ---\n${body}`;
  });
  return [SAJU_DIRECTIVE, ...parts].join("\n\n");
}
