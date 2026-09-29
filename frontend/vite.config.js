import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  build: {
    // Split the heavy, rarely-changing libraries out of the app bundle so they
    // stay cached across deploys.
    //
    // The per-group regexes are deliberately broad but non-overlapping: each
    // vendor group claims its own directory and nothing else. Overlapping
    // groups make the bundler do far more bookkeeping, which showed up as an
    // out-of-memory crash during chunk rendering.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: "router", test: /node_modules[\\/]react-router/ },
            { name: "motion", test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/ },
            { name: "icons", test: /node_modules[\\/]lucide-react[\\/]/ },
          ],
        },
      },
    },
  },
});
