import { type Context, type MiddlewareHandler } from "@hono/hono";

/**
 * Deno.bundle を使って index.html をバンドルし、
 * ファイルに書き出さずに Hono ミドルウェアとして serve する
 */
export function createBundleServeMiddleware(): MiddlewareHandler {
  return async (c: Context) => {
    try {
      // ../index.html をエントリーポイントとしてバンドル
      const result = await Deno.bundle({
        entrypoints: ["../index.html"],
        write: false, // ファイルに書き出さない
        format: "esm",
        platform: "browser",
        minify: false,
        sourcemap: "inline",
      });

      // バンドルが失敗した場合
      if (!result.success) {
        console.error("Bundle errors:", result.errors);
        return c.text(
          `Bundle failed:\n${result.errors.map((e) => e.text).join("\n")}`,
          500,
        );
      }

      // 警告があれば表示
      if (result.warnings.length > 0) {
        console.warn("Bundle warnings:", result.warnings);
      }

      // バンドルされたファイルを取得
      if (result.outputFiles && result.outputFiles.length > 0) {
        const outputFile = result.outputFiles[0];
        const content = await outputFile.text();

        // HTML として返す
        return c.html(content);
      }

      return c.text("No output files generated", 500);
    } catch (error_) {
      const error = error_ as Error;
      console.error("Bundle error:", error);
      return c.text(`Error: ${error.message}`, 500);
    }
  };
}

/**
 * バンドルをキャッシュして再利用する版
 * 本番環境ではこちらを推奨
 */
export function createCachedBundleServeMiddleware(): MiddlewareHandler {
  let cachedContent: string | null = null;
  let bundlePromise: Promise<string> | null = null;

  const bundle = async (): Promise<string> => {
    const result = await Deno.bundle({
      entrypoints: ["../index.html"],
      write: false,
      format: "esm",
      platform: "browser",
      minify: false,
      sourcemap: "inline",
    });

    if (!result.success) {
      throw new Error(
        `Bundle failed: ${result.errors.map((e) => e.text).join("\n")}`,
      );
    }

    if (result.warnings.length > 0) {
      console.warn("Bundle warnings:", result.warnings);
    }

    if (!result.outputFiles || result.outputFiles.length === 0) {
      throw new Error("No output files generated");
    }

    return await result.outputFiles[0].text();
  };

  return async (c: Context) => {
    try {
      // キャッシュがあればそれを返す
      if (cachedContent) {
        return c.html(cachedContent);
      }

      // 既にバンドル処理中の場合は待つ
      if (bundlePromise) {
        cachedContent = await bundlePromise;
        return c.html(cachedContent);
      }

      // 新規バンドル
      bundlePromise = bundle();
      cachedContent = await bundlePromise;
      bundlePromise = null;

      return c.html(cachedContent);
    } catch (error) {
      console.error("Bundle error:", error);
      return c.text(`Error: ${error.message}`, 500);
    }
  };
}
