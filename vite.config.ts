import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Dev only: serves the Cloudflare Pages Functions under /api/documents/* straight from `npm run dev`,
 * using the secrets in .dev.vars. In production Cloudflare runs the same files from /functions.
 */
function devFunctions(): Plugin {
  return {
    name: 'dev-pages-functions',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/documents', async (req, res, next) => {
        try {
          const name = (req.url ?? '').split('?')[0].replace(/^\/|\/$/g, '')
          if (!/^[a-z-]+$/.test(name) || req.method !== 'POST') return next()
          const env: Record<string, string> = {}
          try {
            for (const line of readFileSync('.dev.vars', 'utf8').split(/\r?\n/)) {
              const i = line.indexOf('=')
              if (i > 0 && !line.trim().startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
            }
          } catch { /* no .dev.vars */ }
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const mod = await server.ssrLoadModule(`/functions/api/documents/${name}.ts`)
          const request = new Request(`http://localhost${req.originalUrl ?? req.url}`, {
            method: 'POST',
            headers: req.headers as Record<string, string>,
            body: Buffer.concat(chunks),
          })
          const response: Response = await mod.onRequestPost({ request, env })
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (e) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Function error' }))
        }
      })
    },
  }
}

export default defineConfig({ plugins: [react(), tailwindcss(), devFunctions()] })
