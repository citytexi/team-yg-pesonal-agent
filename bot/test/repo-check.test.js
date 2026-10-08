import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import {
  DIRTY_WARNING,
  SUBMODULE_MISMATCH_WARNING,
  SUBMODULE_MISSING_WARNING,
  repoWarnings,
  submoduleMissingWarning,
} from "../src/repo-check.js";

test("깨끗한 저장소는 경고가 없다", () => {
  assert.deepEqual(repoWarnings(""), []);
  assert.deepEqual(repoWarnings("\n"), []);
});

test("서브모듈만 어긋나면 서브모듈 경고만 낸다", () => {
  assert.deepEqual(repoWarnings(" M TEAMYG-Android\n"), [SUBMODULE_MISMATCH_WARNING]);
});

test("다른 파일이 바뀌면 dirty 경고를 낸다", () => {
  assert.deepEqual(repoWarnings(" M wiki/index.md\n"), [DIRTY_WARNING]);
});

test("경로에 이름이 들어 있을 뿐인 파일은 서브모듈로 보지 않는다", () => {
  assert.deepEqual(repoWarnings(" M docs/TEAMYG-Android-notes.md\n"), [DIRTY_WARNING]);
  assert.deepEqual(repoWarnings("?? TEAMYG-Android.md\n"), [DIRTY_WARNING]);
});

test("둘이 함께 있으면 두 경고를 모두 낸다", () => {
  assert.deepEqual(
    repoWarnings(" M TEAMYG-Android\n M wiki/index.md\n").sort(),
    [DIRTY_WARNING, SUBMODULE_MISMATCH_WARNING].sort(),
  );
});

test("판정 파일이 없으면 미초기화 경고를 낸다", () => {
  const seen = [];
  const warning = submoduleMissingWarning("/repo", (path) => {
    seen.push(path);
    return false; // 디렉토리는 있어도 비어 있는 상태
  });
  assert.equal(warning, SUBMODULE_MISSING_WARNING);
  assert.deepEqual(seen, [join("/repo", "TEAMYG-Android", "settings.gradle.kts")]);
});

test("판정 파일이 있으면 경고가 없다", () => {
  assert.equal(submoduleMissingWarning("/repo", () => true), null);
});
