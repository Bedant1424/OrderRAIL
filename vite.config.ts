import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("/react/") || id.includes("/react-dom/")) {
              return "vendor-core";
            }
            if (id.includes("/@supabase/") || id.includes("/@tanstack/")) {
              return "vendor-data";
            }
            if (id.includes("/framer-motion/") || id.includes("/lucide-react/")) {
              return "vendor-ui";
            }
            if (id.includes("/recharts/")) {
              return "vendor-charts";
            }
          }
        },
      },
    },
  },
}));
