import { useState, type FormEvent } from 'react'
import { LogIn, LogOut, ShieldCheck } from 'lucide-react'
import type { RouteId } from '@/app/routes'
import { Button, Card, EmptyState, Field, Input, PageHeader } from '@/components/ui'
import { useAuth } from '@/data/auth'
import { connected } from '@/data/supabase'

/** Login da administração. Não há cadastro aberto: as contas são criadas no painel do Supabase. */
export function LoginPage({ onNavigate }: { onNavigate: (r: RouteId) => void }) {
  const { session, name, role, signIn, signOut } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try { await signIn(email, password); onNavigate('mensalidades') }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div className="max-w-md mx-auto">
      <PageHeader icon={ShieldCheck} section="Administração" title="Entrar"
        description="Acesso para registrar alunos e pagamentos. Visitantes veem só os totais no painel." />
      <Card className="p-6">
        {!connected ? (
          <EmptyState icon={ShieldCheck} title="Banco ainda não conectado">
            Este site está em modo demonstração. O login funciona depois que o Supabase for configurado (veja docs/PUBLICAR.md).
          </EmptyState>
        ) : session ? (
          <div className="space-y-4">
            <p className="text-sm">Você entrou como <strong>{name ?? session.user.email}</strong>.</p>
            {!role && <p className="text-sm text-warn">Esta conta ainda não tem papel definido, então não consegue registrar nada. Peça para incluir o perfil no banco.</p>}
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => onNavigate('mensalidades')}>Ir para mensalidades</Button>
              <Button variant="ghost" icon={LogOut} onClick={() => void signOut()}>Sair</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field label="E-mail">{(id) => <Input id={id} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
            <Field label="Senha">{(id) => <Input id={id} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
            {error && <p role="alert" className="text-sm text-bad">{error}</p>}
            <Button type="submit" variant="primary" icon={LogIn} loading={busy} className="w-full">Entrar</Button>
          </form>
        )}
      </Card>
    </div>
  )
}
