#!/usr/bin/env node
const mode = process.env.FAKE_MODE || "success";
const args = process.argv.slice(2);

if (mode === "hang") {
  setTimeout(() => {}, 60000);
} else if (mode === "exit") {
  process.stderr.write("boom\n");
  process.exit(2);
} else if (mode === "garbage") {
  process.stdout.write("not json at all");
} else if (mode === "error-flag") {
  process.stdout.write(JSON.stringify({ is_error: true, subtype: "error_during_execution", result: "", session_id: "s-err" }));
} else if (mode === "empty") {
  process.stdout.write(JSON.stringify({ is_error: false, subtype: "success", result: "   ", session_id: "s-empty" }));
} else if (mode === "echo-args") {
  process.stdout.write(JSON.stringify({ is_error: false, subtype: "success", result: JSON.stringify(args), session_id: "s-echo" }));
} else {
  process.stdout.write(JSON.stringify({ is_error: false, subtype: "success", result: "답변 본문", session_id: "s-ok" }));
}
