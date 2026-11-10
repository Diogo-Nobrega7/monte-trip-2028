// Gateway local que imita o endereço do Supabase: /rest/v1 → PostgREST, /storage/v1 → Storage,
// /auth/v1 → login mínimo de teste (usuários fixos). SÓ PARA TESTE.
import http from 'node:http'
import { sign } from './jwt.mjs'
const USERS = [
  { id: 'a0000000-0000-0000-0000-000000000001', email: 'davi@teste.local', password: 'senha-admin-123' },
  { id: 'b0000000-0000-0000-0000-000000000002', email: 'prof@teste.local', password: 'senha-prof-123' },
]
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD', 'access-control-expose-headers': '*' }
const session = (u) => {
  const now = Math.floor(Date.now() / 1000)
  const user = { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  return { access_token: sign({ sub: u.id, role: 'authenticated', aud: 'authenticated', email: u.email, exp: now + 3600, iat: now }), token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: `r-${u.id}`, user }
}
const body = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => r(b)) })
const json = (res, code, obj) => { res.writeHead(code, { ...cors, 'content-type': 'application/json' }); res.end(JSON.stringify(obj)) }
http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end() }
  const url = new URL(req.url, 'http://x')
  if (url.pathname.startsWith('/auth/v1')) {
    const p = url.pathname.slice(8)
    if (p === '/token') {
      const b = JSON.parse((await body(req)) || '{}')
      const u = url.searchParams.get('grant_type') === 'refresh_token'
        ? USERS.find((x) => `r-${x.id}` === b.refresh_token)
        : USERS.find((x) => x.email === b.email && x.password === b.password)
      return u ? json(res, 200, session(u)) : json(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 400, msg: 'Invalid login credentials' })
    }
    if (p === '/user') {
      const t = (req.headers.authorization ?? '').replace('Bearer ', '')
      try { const sub = JSON.parse(Buffer.from(t.split('.')[1], 'base64url')).sub; const u = USERS.find((x) => x.id === sub); if (u) return json(res, 200, session(u).user) } catch {}
      return json(res, 401, { msg: 'invalid token' })
    }
    if (p === '/logout') { res.writeHead(204, cors); return res.end() }
    return json(res, 404, { msg: 'not found' })
  }
  const target = url.pathname.startsWith('/rest/v1') ? { port: 3000, path: url.pathname.slice(8) || '/' }
    : url.pathname.startsWith('/storage/v1') ? { port: 5000, path: url.pathname.slice(11) || '/' } : null
  if (!target) return json(res, 404, { msg: 'not found' })
  const up = http.request({ host: '127.0.0.1', port: target.port, path: target.path + url.search, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${target.port}` } }, (r) => {
    res.writeHead(r.statusCode, { ...r.headers, ...cors }); r.pipe(res)
  })
  up.on('error', (e) => json(res, 502, { msg: e.message }))
  req.pipe(up)
}).listen(54321, () => console.log('gateway em http://localhost:54321'))
