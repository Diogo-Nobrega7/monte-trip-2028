import { createHmac } from 'node:crypto'
export const SECRET = 'segredo-de-teste-local-com-mais-de-32-caracteres'
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url')
export function sign(payload) {
  const h = b64({ alg: 'HS256', typ: 'JWT' }), p = b64(payload)
  return `${h}.${p}.${createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')}`
}
const exp = Math.floor(Date.now() / 1000) + 3600 * 24 * 30
export const ANON = sign({ role: 'anon', iss: 'supabase', exp })
export const SERVICE = sign({ role: 'service_role', iss: 'supabase', exp })
if (process.argv[2] === 'print') console.log(`ANON=${ANON}\nSERVICE=${SERVICE}`)
