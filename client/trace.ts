import { OtlpExporter } from "bunseki/exporter.browser.js";

const otlp = new OtlpExporter({
  serviceName: "gdrive-tree.kuboon-tokyo.deno.net",
});
let span = await otlp.onPageLoad();
globalThis.addEventListener("error", (ev) => {
  span.postError(ev.error);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    span.post();
  } else {
    span = span.trace.newSpan({ name: "page-visible" });
  }
});

export { span };
