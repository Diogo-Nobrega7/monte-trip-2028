import { FileBarChart, FileCheck, FileSignature, FileText, Lock, ReceiptText, ScrollText, Upload, Users } from 'lucide-react'
import { Badge, Button, Card, PageHeader, StageNotice, Tooltip } from '@/components/ui'

const GROUPS = [
  { icon: ScrollText, name: 'Regulamento', text: 'Regras de adesão, pagamento, atraso e desistência.', access: 'Todos os participantes', open: true },
  { icon: FileSignature, name: 'Autorizações', text: 'Autorização dos responsáveis para cada aluno menor de idade.', access: 'Administração', open: false },
  { icon: FileCheck, name: 'Contratos', text: 'Contrato com a agência e termos assinados.', access: 'Administração e professor', open: false },
  { icon: ReceiptText, name: 'Recibos e comprovantes', text: 'Comprovantes de pagamentos e despesas.', access: 'Administração', open: false },
  { icon: FileBarChart, name: 'Relatórios', text: 'Prestações de contas periódicas e final.', access: 'Todos os participantes', open: true },
]

export function DocumentsPage() {
  return (
    <>
      <PageHeader icon={FileText} section="Organização" title="Documentos" description="Arquivos oficiais do projeto, com acesso definido por tipo de documento."
        actions={<Tooltip content="Disponível na etapa 4"><span><Button variant="primary" icon={Upload} disabled>Enviar arquivo</Button></span></Tooltip>} />
      <StageNotice>Envio e armazenamento de arquivos chegam na etapa 4. Documentos pessoais de alunos nunca ficam públicos.</StageNotice>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {GROUPS.map((g) => (
          <Card key={g.name} as="article" className="group p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
            <div className="flex items-start justify-between">
              <span className="grid place-items-center size-10 rounded-md bg-accent/10 text-accent"><g.icon size={19} aria-hidden /></span>
              <Badge>0 arquivos</Badge>
            </div>
            <p className="font-semibold mt-4">{g.name}</p>
            <p className="text-sm text-muted mt-1 leading-relaxed">{g.text}</p>
            <p className="flex items-center gap-1.5 text-[12px] text-faint mt-4 pt-4 border-t border-line">
              {g.open ? <Users size={13} aria-hidden /> : <Lock size={13} aria-hidden />}{g.access}
            </p>
          </Card>
        ))}
      </div>
      <p className="text-xs text-faint mt-4">Formatos previstos: PDF e imagens, até 10 MB por arquivo.</p>
    </>
  )
}
