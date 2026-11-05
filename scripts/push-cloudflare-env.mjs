// Pushes the plain-text variables in cloudflare-pages.env to a Cloudflare Pages project (Production + Preview)
// through the Cloudflare API. The file is gitignored; this script contains no secrets.
//
//   CLOUDFLARE_API_TOKEN=...  CLOUDFLARE_ACCOUNT_ID=...  node scripts/push-cloudflare-env.mjs [project-name]
//
// Token: dash.cloudflare.com > My Profile > API Tokens > Create Token > custom, permission
// "Account > Cloudflare Pages > Edit". Delete the token afterwards if you like.
import { readFileSync } from 'node:fs'

const token = process.env.CLOUDFLARE_API_TOKEN
const account = process.env.CLOUDFLARE_ACCOUNT_ID
const project = process.argv[2] || 'askus-insurance'
if (!token || !account) {
  console.error('Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID first.')
  process.exit(1)
}

const vars = {}
for (const line of readFileSync(new URL('../cloudflare-pages.env', import.meta.url), 'utf8').split(/\r?\n/)) {
  const t = line.trim()
  if (!t || t.startsWith('#') || !t.includes('=')) continue
  const i = t.indexOf('=')
  vars[t.slice(0, i)] = { type: 'plain_text', value: t.slice(i + 1) }
}

const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${project}`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ deployment_configs: { production: { env_vars: vars }, preview: { env_vars: vars } } }),
})
const body = await res.json()
if (!res.ok || !body.success) {
  console.error('Failed:', JSON.stringify(body.errors ?? body))
  process.exit(1)
}
console.log(`Set ${Object.keys(vars).length} variables on "${project}" (production + preview):`)
console.log(Object.keys(vars).join('\n'))
console.log('Now redeploy: Cloudflare dashboard > Deployments > Retry, or push a commit.')
