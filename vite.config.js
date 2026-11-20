import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      includeAssets: ['icon.png'],
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
