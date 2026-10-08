import { existsSync } from "node:fs";
import { join } from "node:path";

export const SUBMODULE_PATH = "TEAMYG-Android";
export const DIRTY_WARNING = "WARNING: repo working tree is dirty; the bot must never write";
export const SUBMODULE_MISMATCH_WARNING =
  "WARNING: TEAMYG-Android submodule is not at the pinned commit; run: git submodule update --init TEAMYG-Android";
export const SUBMODULE_MISSING_WARNING =
  "WARNING: TEAMYG-Android submodule is not initialized; code lookups are disabled. run: git submodule update --init TEAMYG-Android";

// An uninitialized submodule is an empty directory, so the directory alone
// proves nothing. This file sits at the root of every checkout of that repo.
const SUBMODULE_MARKER = "settings.gradle.kts";

// Takes `git status --porcelain` output. A v1 line is two status characters,
// a space, then the path. Do not trim the whole output first: the first line
// may start with a space, and trimming it shifts the path.
// A submodule that is off its pinned commit is the host forgetting
// `git submodule update`, not the bot writing, so it gets its own message.
export function repoWarnings(porcelain) {
  const warnings = new Set();
  for (const line of porcelain.split("\n")) {
    if (line.trim().length === 0) continue;
    warnings.add(line.slice(3) === SUBMODULE_PATH ? SUBMODULE_MISMATCH_WARNING : DIRTY_WARNING);
  }
  return [...warnings];
}

export function submoduleMissingWarning(repoRoot, exists = existsSync) {
  return exists(join(repoRoot, SUBMODULE_PATH, SUBMODULE_MARKER)) ? null : SUBMODULE_MISSING_WARNING;
}
