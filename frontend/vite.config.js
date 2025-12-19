import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Whether to polyfill specific globals.
      globals: {
        Buffer: true, 
        global: true,
        process: true,
      },
      // Whether to polyfill Node.js built-in modules which are used by simple-peer
      protocolImports: true,
    }),
  ],
  // We keep this as a secondary shim
  define: {
    global: 'window',
  },
});