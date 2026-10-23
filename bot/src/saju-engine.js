import { execFile as nodeExecFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const DEFAULT_ERROR = "사주 엔진 실행에 실패했습니다.";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const REGION_RE = /^[가-힣A-Za-z][가-힣A-Za-z ]{0,19}$/;

/**
 * Validates one person's input and builds engine CLI args.
 * Every value is whitelisted, so no user text can look like a flag.
 */
export function personArgs(person) {
  const p = person ?? {};
  const fail = (error) => ({ ok: false, error });

  const calendar = p.calendar ?? "solar";
  if (p.calendar !== undefined && p.calendar !== "solar" && p.calendar !== "lunar") {
    return fail("calendar는 solar 또는 lunar여야 합니다.");
  }

  if (typeof p.date !== "string" || !DATE_RE.test(p.date)) {
    return fail("date는 YYYY-MM-DD 형식이어야 합니다.");
  }
  const [y, m, d] = p.date.split("-").map(Number);
  if (calendar === "lunar") {
    if (m < 1 || m > 12 || d < 1 || d > 30) return fail("음력 date의 월(1~12)·일(1~30)이 올바르지 않습니다.");
  } else {
    const back = new Date(Date.UTC(y, m - 1, d));
    if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) {
      return fail("존재하지 않는 양력 날짜입니다.");
    }
  }

  const time = p.time ?? "모름";
  if (time !== "모름" && !(typeof time === "string" && TIME_RE.test(time))) {
    return fail("time은 HH:MM 형식이거나 \"모름\"이어야 합니다.");
  }

  if (p.gender !== "남" && p.gender !== "여") return fail("gender는 \"남\" 또는 \"여\"여야 합니다.");

  if (p.region !== undefined && p.region !== "모름" && !(typeof p.region === "string" && REGION_RE.test(p.region))) {
    return fail("region은 한글·영문 도시 이름이어야 합니다.");
  }

  if (p.leap !== undefined && typeof p.leap !== "boolean") return fail("leap은 불리언이어야 합니다.");
  if (p.leap === true && calendar !== "lunar") return fail("leap은 음력(calendar: lunar)에서만 쓸 수 있습니다.");

  if (p.sewoonYear !== undefined && !(Number.isInteger(p.sewoonYear) && p.sewoonYear >= 1900 && p.sewoonYear <= 2100)) {
    return fail("sewoonYear는 1900~2100 정수여야 합니다.");
  }

  const args = ["--date", p.date, "--time", time, "--gender", p.gender];
  if (p.region !== undefined) args.push("--region", p.region);
  if (p.calendar !== undefined) args.push("--calendar", p.calendar);
  if (p.leap === true) args.push("--leap");
  if (p.sewoonYear !== undefined) args.push("--sewoon-year", String(p.sewoonYear));
  return { ok: true, args };
}

function lastStderrLine(stderr, skillDir) {
  const lines = String(stderr ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return DEFAULT_ERROR;
  const line = lines[lines.length - 1];
  return skillDir ? line.split(skillDir).join("<skill>") : line;
}

/** Runs the engine once. stdout JSON wins regardless of exit code. */
async function runEngine(execFile, { pythonBin, skillDir, timeoutMs }, args) {
  const script = path.join(skillDir, "scripts", "saju.py");
  let stdout = "";
  let stderr = "";
  try {
    ({ stdout, stderr } = await execFile(pythonBin, [script, ...args], {
      timeout: timeoutMs,
      maxBuffer: 4 * 1024 * 1024,
      encoding: "utf8",
    }));
  } catch (err) {
    stdout = err?.stdout ?? "";
    stderr = err?.stderr ?? "";
  }
  try {
    const parsed = JSON.parse(String(stdout));
    if (parsed !== null && typeof parsed === "object") return { ok: true, result: parsed };
  } catch {
    // fall through to stderr-based error
  }
  return { ok: false, error: lastStderrLine(stderr, skillDir) };
}

export async function runSajuCalc(
  input,
  { pythonBin = "python3", skillDir, timeoutMs = 30000, execFile = promisify(nodeExecFile), tmpRoot = os.tmpdir() } = {},
) {
  const ctx = { pythonBin, skillDir, timeoutMs };
  const person = personArgs(input);
  if (!person.ok) return person;
  let partner = null;
  if (input.partner !== undefined) {
    partner = personArgs(input.partner);
    if (!partner.ok) return { ok: false, error: `partner: ${partner.error}` };
  }

  const a = await runEngine(execFile, ctx, person.args);
  if (!a.ok || !partner) return a;

  const b = await runEngine(execFile, ctx, partner.args);
  if (!b.ok) return b;
  if ("error" in a.result) return a;
  if ("error" in b.result) return b;

  const dir = await mkdtemp(path.join(tmpRoot, "saju-compat-"));
  try {
    const fileA = path.join(dir, "a.json");
    const fileB = path.join(dir, "b.json");
    await writeFile(fileA, JSON.stringify(a.result));
    await writeFile(fileB, JSON.stringify(b.result));
    const c = await runEngine(execFile, ctx, ["--compat", fileA, fileB]);
    if (!c.ok) return c;
    return { ok: true, result: { person: a.result, partner: b.result, compat: c.result } };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
