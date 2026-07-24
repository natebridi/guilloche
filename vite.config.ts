import { defineConfig } from "vite";

const port = Number(process.env.PORT) || 5173;

export default defineConfig({
  server: {
    port,
    strictPort: true,
  },
});
