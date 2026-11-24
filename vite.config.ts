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
        'favicon.png',
        'icons/*.png',
        'assets/*.jpg',
        'assets/*.png',
      ],
      manifest: {
        name: 'Carrinho de Compras Inteligente',
        short_name: 'Carrinho',
        description:
          'Aplicativo inteligente de lista e carrinho de compras com leitura de cupom fiscal, comparação de preços e sincronização em família.',
        theme_color: '#00C853',
        background_color: '#F8F9FA',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'pt-BR',
        icons: [
          {
            src: '/icons/Icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/Icon-512.png',
            sizes: '512x512',
            type: 'image/png',
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
