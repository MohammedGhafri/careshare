import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// The CareShare API (server/index.js) runs on :3001 — see "npm run dev"'s
// dev:api script. Both the dev server and the production preview proxy
// /api/* to it so the client can always call same-origin relative paths
// (src/lib/api.js), with no CORS setup needed in either mode.
const apiProxy = {
  '/api': {
    target: 'http://localhost:3001',
    changeOrigin: true,
  },
}

export default defineConfig({
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      includeAssets: ['icon.png'],
      workbox: {
        // Never let the service worker answer /api/* from its cache —
        // those requests must always reach the live CareShare API.
        navigateFallbackDenylist: [/^\/api/],
      },
      manifest: {
        name: 'CareShare',
        short_name: 'CareShare',
        description: "CareShare helps a trusted care circle see today's medication, visits, tasks and alerts in one place.",
        theme_color: '#0F766E',
        background_color: '#F1F5F9',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon.png', sizes: '1024x1024', type: 'image/png' },
          { src: 'icon.png', sizes: '1024x1024', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
})
