import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['logo.png'],
        workbox: {
          /*
           * The door tablet's face recognition — seven megabytes of model
           * weights plus a 1.3MB library — is fetched when that one screen is
           * opened, and never precached. Left in the manifest it would be
           * downloaded by every student's phone on their first visit, for a
           * screen only the office will ever see.
           */
          globIgnores: ['**/models/face/**', '**/vendor-face-*.js'],
        },
        manifest: {
          name: 'School Management System — Demo',
          short_name: 'School Demo',
          description: 'Interactive demo of a school management system',
          theme_color: '#0b1f80',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: 'logo.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'logo.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    build: {
      // Split the dependencies out of the app bundle so a code change does not
      // invalidate ~350KB of unchanged vendor code in every user's cache.
      rollupOptions: {
        output: {
          // Matching on the resolved path catches sub-entries too
          // (react-dom/client, motion/react, ...), which the array form misses.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router)/.test(id)) return 'vendor-react';
            if (/[\\/]node_modules[\\/](motion|framer-motion)/.test(id)) return 'vendor-motion';
            if (/[\\/]node_modules[\\/]lucide-react/.test(id)) return 'vendor-icons';
            // Only the gate screen ever imports this; keep it out of everyone
            // else's download.
            if (/[\\/]node_modules[\\/]@vladmandic[\\/]face-api/.test(id)) return 'vendor-face';
            return 'vendor';
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
