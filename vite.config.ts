import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Static, relative-base build so it can be hosted from any folder or opened from a school file server.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2500,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'MathRacing - Lumba Matematik',
        short_name: 'MathRacing',
        description:
          'Permainan lumba matematik luar talian untuk 2-5 murid Tahun 1 dan Tahun 2 (KSSR).',
        lang: 'ms',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#0b1d3a',
        theme_color: '#0b1d3a',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Cache the application shell and local assets only. No runtime caching of remote origins.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      devOptions: { enabled: false },
    }),
  ],
});
