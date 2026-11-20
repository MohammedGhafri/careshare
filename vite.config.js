import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Serves the Vercel function in api/care.js from `npm run dev`, so the
// database works locally without the Vercel CLI. DATABASE_URL is read from
// .env.local (e.g. created with `vercel env pull .env.local`).
// DATABASE_URL=pglite:<folder> (or just `pglite:` for in-memory) uses an
// embedded Postgres instead of Neon — handy for offline development.
async function pgliteHandler(url) {
  const [{ PGlite }, { createCareApi }, { pgliteSql }] = await Promise.all([
    import('@electric-sql/pglite'),
    import('./server/careApi.js'),
    import('./server/pgliteSql.js'),
  ])
  const dataDir = url.slice('pglite:'.length) || undefined
  return { fetch: createCareApi(pgliteSql(new PGlite(dataDir))) }
}

function careApiDevServer() {
  return {
    name: 'careshare-api-dev-server',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      for (const key of ['DATABASE_URL', 'POSTGRES_URL']) {
        if (env[key] && !process.env[key]) process.env[key] = env[key]
      }

      let pglite = null
      server.middlewares.use('/api/care', async (req, res, next) => {
        try {
          const handler = env.DATABASE_URL?.startsWith('pglite:')
            ? await (pglite ??= pgliteHandler(env.DATABASE_URL))
            : (await server.ssrLoadModule('/api/care.js')).default
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const headers = {}
          for (const key of ['accept', 'content-type']) if (req.headers[key]) headers[key] = req.headers[key]
          const request = new Request(new URL(req.originalUrl, 'http://localhost'), {
            method: req.method,
            headers,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
          })
          const response = await handler.fetch(request)
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (err) {
          next(err)
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    careApiDevServer(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      includeAssets: ['icon.png'],
      workbox: { navigateFallbackDenylist: [/^\/api\//] },
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
