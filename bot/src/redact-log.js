// Wraps a log function so any `detail` field in a context object is replaced
// by its length. Saju failure details can echo claude output with birth data.
export function redactDetail(log) {
  return (message, ...rest) =>
    log(
      message,
      ...rest.map((arg) =>
        arg !== null && typeof arg === "object" && "detail" in arg
          ? { ...arg, detail: `<redacted ${String(arg.detail ?? "").length} chars>` }
          : arg,
      ),
    );
}
