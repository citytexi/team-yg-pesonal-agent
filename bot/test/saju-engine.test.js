import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import os from "node:os";
import { personArgs, runSajuCalc } from "../src/saju-engine.js";

const base = { date: "1990-05-15", time: "07:30", gender: "남", region: "서울" };

test("정상 입력이 인자 배열로 바뀐다", () => {
  assert.deepEqual(personArgs(base), {
    ok: true,
    args: ["--date", "1990-05-15", "--time", "07:30", "--gender", "남", "--region", "서울"],
  });
});

test("time을 생략하면 --time 모름이 들어간다", () => {
  const r = personArgs({ date: "1990-05-15", gender: "여" });
  assert.deepEqual(r.args, ["--date", "1990-05-15", "--time", "모름", "--gender", "여"]);
});

test("calendar, leap, sewoonYear 인자가 붙는다", () => {
  const r = personArgs({ ...base, calendar: "lunar", leap: true, sewoonYear: 2026 });
  assert.ok(r.ok);
  assert.deepEqual(r.args.slice(-5), ["--calendar", "lunar", "--leap", "--sewoon-year", "2026"]);
});

for (const [name, patch] of [
  ["region --compat", { region: "--compat" }],
  ["region -x", { region: "-x" }],
  ["region 셸 문자", { region: "서울; rm -rf ~" }],
  ["region 명령 치환", { region: "$(id)" }],
  ["date 자릿수 부족", { date: "1990-5-15" }],
  ["양력 존재하지 않는 날짜", { date: "1990-02-30" }],
  ["gender 영문", { gender: "male" }],
  ["양력에 leap", { leap: true }],
  ["sewoonYear 범위 밖", { sewoonYear: 3000 }],
  ["time 형식 오류", { time: "25:00" }],
  ["calendar 오류", { calendar: "x" }],
]) {
  test(`거부: ${name}`, () => {
    const r = personArgs({ ...base, ...patch });
    assert.equal(r.ok, false);
    assert.equal(typeof r.error, "string");
  });
}

test("음력 30일은 허용된다", () => {
  assert.equal(personArgs({ ...base, date: "1990-02-30", calendar: "lunar" }).ok, true);
});

test("음력 월 13은 거부된다", () => {
  assert.equal(personArgs({ ...base, date: "1990-13-01", calendar: "lunar" }).ok, false);
});

function fakeExec(handler) {
  const calls = [];
  const execFile = async (file, args, options) => {
    calls.push({ file, args, options });
    const out = handler(args, calls.length);
    if (out.code) {
      const err = new Error("fail");
      err.code = out.code;
      err.stdout = out.stdout ?? "";
      err.stderr = out.stderr ?? "";
      throw err;
    }
    return { stdout: out.stdout ?? "", stderr: out.stderr ?? "" };
  };
  return { execFile, calls };
}

const opts = (execFile, extra = {}) => ({
  pythonBin: "python3",
  skillDir: "/skills/saju",
  timeoutMs: 1000,
  execFile,
  ...extra,
});

test("정상 실행은 JSON 결과를 돌려준다", async () => {
  const { execFile, calls } = fakeExec(() => ({ stdout: '{"pillars":1}' }));
  const r = await runSajuCalc(base, opts(execFile));
  assert.deepEqual(r, { ok: true, result: { pillars: 1 } });
  assert.equal(calls[0].file, "python3");
  assert.equal(calls[0].args[0], "/skills/saju/scripts/saju.py");
});

test("종료 코드 1이어도 stdout이 JSON이면 결과로 쓴다", async () => {
  const { execFile } = fakeExec(() => ({ code: 1, stdout: '{"error":"범위 밖"}' }));
  assert.deepEqual(await runSajuCalc(base, opts(execFile)), { ok: true, result: { error: "범위 밖" } });
});

test("stdout 없이 stderr로 실패하면 마지막 줄이 오류가 된다", async () => {
  const { execFile } = fakeExec(() => ({
    code: 1,
    stderr: "Traceback (most recent call last):\nValueError: day is out of range\n\n",
  }));
  assert.deepEqual(await runSajuCalc(base, opts(execFile)), {
    ok: false,
    error: "ValueError: day is out of range",
  });
});

test("stderr의 스킬 경로는 <skill>로 가려진다", async () => {
  const { execFile } = fakeExec(() => ({ code: 1, stderr: "File /skills/saju/scripts/saju.py boom" }));
  const r = await runSajuCalc(base, opts(execFile));
  assert.equal(r.error, "File <skill>/scripts/saju.py boom");
});

test("stderr의 홈 디렉토리는 ~로 가려진다", async () => {
  const home = os.homedir();
  const { execFile } = fakeExec(() => ({ code: 1, stderr: `File ${home}/x/y.py boom` }));
  const r = await runSajuCalc(base, opts(execFile));
  assert.equal(r.error, "File ~/x/y.py boom");
  assert.ok(!r.error.includes(home));
});

test("stderr가 비어 있으면 기본 오류 문구", async () => {
  const { execFile } = fakeExec(() => ({ code: 1 }));
  assert.deepEqual(await runSajuCalc(base, opts(execFile)), {
    ok: false,
    error: "사주 엔진 실행에 실패했습니다.",
  });
});

test("stdout이 JSON이 아니면 실패", async () => {
  const { execFile } = fakeExec(() => ({ stdout: "not json" }));
  assert.equal((await runSajuCalc(base, opts(execFile))).ok, false);
});

test("잘못된 입력은 엔진을 실행하지 않는다", async () => {
  const { execFile, calls } = fakeExec(() => ({ stdout: "{}" }));
  const r = await runSajuCalc({ ...base, region: "--compat" }, opts(execFile));
  assert.equal(r.ok, false);
  assert.equal(calls.length, 0);
});

test("궁합은 3번 실행하고 임시 디렉토리를 지운다", async () => {
  const files = [];
  const { execFile, calls } = fakeExec((args, n) => {
    if (n === 3) files.push(args[2], args[3]);
    return { stdout: `{"n":${n}}` };
  });
  const r = await runSajuCalc({ ...base, partner: { ...base, gender: "여" } }, opts(execFile));
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[2].args.slice(1, 2), ["--compat"]);
  assert.match(calls[2].args[2], /a\.json$/);
  assert.match(calls[2].args[3], /b\.json$/);
  assert.deepEqual(r, { ok: true, result: { person: { n: 1 }, partner: { n: 2 }, compat: { n: 3 } } });
  assert.equal(existsSync(files[0]), false);
  assert.equal(existsSync(files[0].replace(/a\.json$/, "")), false);
});

test("궁합에서 한쪽이 error면 2번만 실행한다", async () => {
  const { execFile, calls } = fakeExec((args, n) => ({ stdout: n === 2 ? '{"error":"x"}' : "{}" }));
  const r = await runSajuCalc({ ...base, partner: base }, opts(execFile));
  assert.equal(calls.length, 2);
  assert.deepEqual(r, { ok: true, result: { error: "x" } });
});

test("execFile 옵션에 shell이 없다", async () => {
  const { execFile, calls } = fakeExec(() => ({ stdout: "{}" }));
  await runSajuCalc({ ...base, partner: base }, opts(execFile));
  for (const c of calls) {
    assert.equal("shell" in c.options, false);
    assert.equal(c.options.timeout, 1000);
  }
});
