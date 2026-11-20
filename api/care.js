import { neon } from '@neondatabase/serverless'
import { createCareApi } from '../server/careApi.js'

// Vercel's Neon integration sets DATABASE_URL (POSTGRES_URL on older setups).
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
const handle = databaseUrl ? createCareApi(neon(databaseUrl)) : null

export default {
  fetch(request) {
    if (!handle) {
      return Response.json({ error: 'not_configured' }, { status: 503, headers: { 'cache-control': 'no-store' } })
    }
    return handle(request)
  },
}
