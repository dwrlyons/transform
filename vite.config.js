import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev-server proxy is not needed: the /api function runs on the host.
// For local development with `vercel dev` or `netlify dev`, requests to
// /api/messages are handled by those CLIs automatically.
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist" },
});
