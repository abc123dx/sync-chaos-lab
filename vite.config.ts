import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Vite 8's Rolldown pipeline does not yet consume wasm-bindgen's direct
    // ESM WebAssembly import. This wrapper initializes Automerge's supported
    // slim build from its packaged base64 module using the current API.
    alias: [
      {
        find: /^@automerge\/automerge$/,
        replacement: fileURLToPath(
          new URL("./src/core/automerge-browser.ts", import.meta.url),
        ),
      },
    ],
  },
  build: {
    chunkSizeWarningLimit: 5000,
    outDir: "dist/web",
    sourcemap: true,
  },
});
