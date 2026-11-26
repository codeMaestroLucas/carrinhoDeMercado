import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'favicon.png',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'apple-touch-icon.png',
        'safari-pinned-tab.svg',
        'icons/*.png',
        'assets/*.jpg',
        'assets/*.png',
      ],
      manifest: {
        name: 'Carrinho de Compras Inteligente',
        short_name: 'Carrinho',
        description:
          'Aplicativo inteligente de lista e carrinho de compras com leitura de cupom fiscal, comparação de preços e sincronização em família.',
        theme_color: '#F5F5F7',
        background_color: '#F5F5F7',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'pt-BR',
        icons: [
          {
            src: '/icons/Icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/Icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/Icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/Icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Adicionar item rápido',
            short_name: 'Novo item',
            description: 'Abre o app direto para adicionar um item à lista',
            url: '/?action=quick-add',
            icons: [{ src: '/icons/Icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Importar cupom fiscal',
            short_name: 'Ler cupom',
            description: 'Importa cupom fiscal por QR Code ou foto',
            url: '/?action=scan-receipt',
            icons: [{ src: '/icons/Icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,json,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          // 1. Google Fonts Stylesheets (Stale-While-Revalidate)
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // 2. Google Fonts Webfont binaries (CacheFirst with 1-year expiration)
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // 3. Static Images and Vector Graphics (Stale-While-Revalidate)
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif|ico)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'app-images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // 4. Lottie Animations and Local JSON Assets (Stale-While-Revalidate)
          {
            urlPattern: /\.(?:json)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'json-assets-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 14,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // 5. JavaScript & CSS chunks (Stale-While-Revalidate for offline readiness)
          {
            urlPattern: /\.(?:js|css)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-resources',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // 6. External SEFAZ / NFC-e Proxy APIs (NetworkFirst with 3s timeout for 3G resilience)
          {
            urlPattern: /^https:\/\/api\.allorigins\.win\/raw\?.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'sefaz-proxy-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // 7. Firestore API (NetworkOnly, managed by Firestore's internal persistentLocalCache)
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'zustand'],
          firebase: ['firebase/app', 'firebase/firestore'],
          charts: ['recharts'],
          lottie: ['lottie-react'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
