import type { MiddlewareHandler } from "@hono/hono";

/**
 * Deno.bundle を使って index.html をバンドルし、
 * ファイルに書き出さずに Hono ミドルウェアとして serve する
 */
const extToMime: Record<string, string> = {
  html: "text/html",
  js: "application/javascript",
  css: "text/css",
};
export function createBundleServeMiddleware(
  bundleResult: Deno.bundle.Result,
): MiddlewareHandler {
  const mapping =
    bundleResult.outputFiles?.reduce<Record<string, Response>>((acc, file) => {
      const path = file.path;
      const ext = path.split(".").pop();
      const mime = (ext && extToMime[ext]) || "application/octet-stream";
      acc[file.path] = new Response(file.contents, {
        headers: {
          "Content-Type": mime,
        },
      });
      return acc;
    }, {}) || {};
  return (c, next) => {
    const reqUrl = new URL(c.req.url);
    const pathname = reqUrl.pathname === "/" ? "/index.html" : reqUrl.pathname;
    const response = mapping[pathname];
    if (response) {
      return Promise.resolve(response.clone());
    }
    return next();
  };
}
