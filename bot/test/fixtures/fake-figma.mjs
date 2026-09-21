#!/usr/bin/env node
const mode = process.env.FAKE_MODE || "success";

if (mode === "hang") {
  setTimeout(() => {}, 60000);
} else if (mode === "exit") {
  process.stderr.write("Traceback: HTTP Error 403\n");
  process.exit(1);
} else if (mode === "empty") {
  process.stdout.write("   \n");
} else if (mode === "flood") {
  process.stdout.write("x".repeat(3 * 1024 * 1024));
  setTimeout(() => {}, 60000);
} else if (mode === "echo-env") {
  process.stdout.write(
    JSON.stringify({
      token: process.env.FIGMA_TOKEN ?? null,
      files: process.env.FIGMA_FILES ?? null,
      reportDir: process.env.FIGMA_REPORT_DIR ?? null,
      discord: process.env.DISCORD_TOKEN ?? null,
      argv: process.argv.slice(2),
    })
  );
} else {
  process.stdout.write("리포트 본문\n");
}
