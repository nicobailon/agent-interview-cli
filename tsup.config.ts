import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts", "src/lib.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  dts: { entry: ["src/lib.ts"] },
  splitting: true,
});
