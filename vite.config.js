import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4174",
        changeOrigin: true,
      },
      "/local-challenge": {
        target: "http://127.0.0.1:4175",
        changeOrigin: true,
      },
      "/local-folders": {
        target: "http://127.0.0.1:4175",
        changeOrigin: true,
      },
      "/local-files": {
        target: "http://127.0.0.1:4175",
        changeOrigin: true,
      },
      "/local-verify": {
        target: "http://127.0.0.1:4175",
        changeOrigin: true,
      },
    },
  },
});
