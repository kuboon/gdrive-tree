export function bundle(write: boolean): Promise<Deno.bundle.Result> {
  const outputDir = write ? "./dist" : "/";
  return Deno.bundle({
    entrypoints: ["client/index.html"],
    write,
    format: "esm",
    platform: "browser",
    minify: false,
    outputDir,
    sourcemap: "inline",
  });
}

if (import.meta.main) {
  await bundle(true);
}
