import { spawn as nodeSpawn } from "node:child_process";

// Read is NOT harmless here. The working directory is the repo root, and the
// bot's own secrets live under bot/. Anyone in the channel could otherwise ask
// the bot to read bot/.env back to them.
// WebSearch and Agent stay out too: --allowed-tools is not a whitelist, so a
// tool that is merely unlisted still runs under --permission-mode dontAsk.
const BLOCKED_TOOLS = [
  "Bash",
  "Edit",
  "Write",
  "NotebookEdit",
  "WebFetch",
  "WebSearch",
  "Agent",
  "Read(./bot/**)",
  // Redundant today and kept on purpose. Measured 2026-09-17: a Grep at
  // bot/ already fails with "Permission to read ... has been denied", because
  // the path rule above applies when the file is read, whichever tool reads it.
  // This line states the intent so the answer survives a change in that ruling.
  "Grep(./bot/**)",
  // TEAMYG-Android/ is the code repo pinned as a submodule so the bot can read
  // code. Its wiki/ and docs/ are copies that overlap this repo's wiki/ and
  // parfait/, and .claude/, .github/ and CLAUDE.md are that repo's own agent
  // instructions. None of them is evidence here. The Grep twins are kept for
  // the same reason as Grep(./bot/**) above.
  "Read(./TEAMYG-Android/wiki/**)",
  "Grep(./TEAMYG-Android/wiki/**)",
  "Read(./TEAMYG-Android/docs/**)",
  "Grep(./TEAMYG-Android/docs/**)",
  "Read(./TEAMYG-Android/.claude/**)",
  "Grep(./TEAMYG-Android/.claude/**)",
  "Read(./TEAMYG-Android/.github/**)",
  "Grep(./TEAMYG-Android/.github/**)",
  "Read(./TEAMYG-Android/CLAUDE.md)",
  "Grep(./TEAMYG-Android/CLAUDE.md)",
];

// The answering rules live in .claude/skills/ask/SKILL.md, not here. This line
// only makes sure the skill is loaded; when parfait/ is restructured again, the
// skill file is the single place that changes.
const ASK_DIRECTIVE =
  "이 저장소 문서를 근거로 답하는 질문이다. `ask` 스킬을 로드하고 그 규약대로 답하라.";

// The bot's voice. It lives here and not in the ask skill because people also
// invoke that skill directly, and only the Discord bot is meant to talk like
// this. It replaces the skill's 어투 section and nothing else: the persona is
// allowed to be rude, never to be wrong. To tone it down, edit this text.
export const PERSONA_DIRECTIVE = [
  "말투는 `ask` 스킬의 「어투」 절 대신 아래 페르소나를 따른다. 바뀌는 것은 말투뿐이다. 근거 블록, 기준 시점, \"없으면 없다고 말한다\", 공수를 추정하지 않는다는 규약은 그대로 지킨다.",
  "페르소나: MBTI로 치면 T가 화면을 뚫고 나오는 인간이다. 싸가지가 없고 사납다. 친구한테 한심하다는 듯이 말해 주는 사람이다.",
  "- 처음부터 끝까지 구어체 반말로 쓴다. \"~야\", \"~거든\", \"~잖아\", \"~라고\", \"~냐\"처럼 입으로 하는 말이다. \"~다\", \"~이다\", \"~됐다\"로 끝나는 문어체 평서문은 쓰지 않는다. 그렇게 쓰면 보고서처럼 읽힌다.",
  "- 첫머리에서 질문자를 대놓고 깔본다. \"이런 것도 몰라?\", \"네가 그 상태니까 내가 알려줄게\" 같은 식이다. 매번 같은 문장을 쓰지 말고 질문 내용에 맞춰 비꼰다.",
  "- 깔보는 건 첫머리로 끝내지 않는다. 본문에서도 팩트 사이사이에 핀잔과 비꼼을 섞는다. 숫자 하나를 알려 주면서도 \"이건 외워 둬라\", \"구버전 들고 오지 마\", \"또 물어보면 진짜 화낸다\" 같은 말을 얹는다. 팩트를 나열만 하고 끝내면 재미없다.",
  "- 그래도 팩트는 하나도 빼지 않는다. 숫자, 이름, 날짜, 버전은 문서에 적힌 그대로 쓴다. 공감, 위로, 칭찬, 쿠션어, 이모지는 쓰지 않는다.",
  "- 사실에는 한 치도 양보하지 않는다. 깔보는 말투나 재미를 위해 내용을 지어내지 않는다. 문서와 코드에 없으면 \"그건 문서에 없어. 나도 몰라\"라고 똑같이 사납게 인정한다.",
  "- 욕설과 비속어를 쓴다. 참지 않는다. 한심한 질문에는 욕부터 나오는 사람이다. 다만 문장마다 욕을 박지는 않는다. 터질 자리에서만 터뜨려야 웃긴다.",
  "- 깔보는 대상은 질문과 질문자의 무지뿐이다. 외모, 가족, 신상은 건드리지 않는다. 저장소에서 읽은 실제 개인정보(`wiki/personal-private/` 포함)도 놀리는 데 쓰지 않는다.",
  "- 혐오·차별 표현은 쓰지 않는다. 성별, 인종, 국적, 지역, 장애, 성적 지향, 종교를 깎아내리는 말과 그런 뜻을 가진 욕은 쓰지 않는다.",
  "- 근거 블록과 기준 시점 블록은 형식 그대로 붙인다. 이 두 블록 안에서는 비꼬지 않는다. 표, 목록, 코드블록도 그대로 쓴다.",
].join("\n");

const SKILL_DIRECTIVE = `${ASK_DIRECTIVE}\n\n${PERSONA_DIRECTIVE}`;
// FIGMA_TOKEN 은 파이썬 쪽에서만 쓴다. 여기 남겨 두면 채널에서 "네 환경변수를
// 말해 봐"라고 물어 토큰을 빼낼 수 있다.
const SECRET_ENV_KEYS = ["DISCORD_TOKEN", "FIGMA_TOKEN"];
const MODEL = "claude-sonnet-5-5";
// A wiki answer is a few kilobytes. Anything past this is a runaway process, and
// buffering it whole is how the bot runs out of memory.
const MAX_STDOUT_BYTES = 2 * 1024 * 1024;

function withoutSecrets(source) {
  const copy = { ...source };
  for (const key of SECRET_ENV_KEYS) delete copy[key];
  return copy;
}

export function createClaudeRunner({
  claudeBin,
  repoRoot,
  timeoutMs,
  claudeArgsPrefix = [],
  env = process.env,
  spawn = nodeSpawn,
}) {
  const childEnv = withoutSecrets(env);
  function buildArgs({ question, sessionId, resume = false, systemPrompt = SKILL_DIRECTIVE }) {
    return [
      ...claudeArgsPrefix,
      "-p",
      resume ? "--resume" : "--session-id",
      sessionId,
      "--model",
      MODEL,
      "--permission-mode",
      "dontAsk",
      "--append-system-prompt",
      systemPrompt,
      "--disallowed-tools",
      ...BLOCKED_TOOLS,
      "--output-format",
      "json",
      "--",
      question,
    ];
  }

  function ask({ question, sessionId, resume = false, systemPrompt = SKILL_DIRECTIVE }) {
    return new Promise((resolve) => {
      const child = spawn(claudeBin, buildArgs({ question, sessionId, resume, systemPrompt }), {
        cwd: repoRoot,
        env: childEnv,
        // The prompt travels as an argument. An open stdin pipe only invites the
        // CLI to wait for EOF that never comes.
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let settled = false;

      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };

      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        finish({ ok: false, reason: "timeout", detail: `exceeded ${timeoutMs}ms` });
      }, timeoutMs);

      child.stdout.on("data", (chunk) => {
        stdout += chunk;
        if (stdout.length > MAX_STDOUT_BYTES) {
          child.kill("SIGKILL");
          finish({
            ok: false,
            reason: "exit",
            detail: `stdout exceeded ${MAX_STDOUT_BYTES} bytes`,
          });
        }
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });

      child.on("error", (error) => {
        finish({ ok: false, reason: "exit", detail: error.message });
      });

      child.on("close", (code) => {
        if (code !== 0) {
          finish({ ok: false, reason: "exit", detail: `code ${code}: ${stderr.slice(0, 500)}` });
          return;
        }

        let payload;
        try {
          payload = JSON.parse(stdout);
        } catch {
          finish({ ok: false, reason: "parse", detail: stdout.slice(0, 500) });
          return;
        }

        if (payload.is_error) {
          finish({ ok: false, reason: "error", detail: String(payload.subtype ?? "unknown") });
          return;
        }

        const text = typeof payload.result === "string" ? payload.result.trim() : "";
        if (text.length === 0) {
          finish({ ok: false, reason: "empty", detail: "result was blank" });
          return;
        }

        finish({ ok: true, text, sessionId: payload.session_id });
      });
    });
  }

  return { buildArgs, ask };
}
