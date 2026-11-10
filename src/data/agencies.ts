import { db, friendly } from './db'
import { cnpjDigits } from '@/lib/cnpj'
import type { Services } from '@/lib/proposals'
import type { Cents, ISODate } from '@/types/domain'

export interface AgencyRow { id: string; name: string; cnpj: string | null; cadastur: string | null; contactName: string | null; phone: string | null; email: string | null; site: string | null; notes: string | null }
export interface ProposalRow {
  id: string; agencyId: string; pricePerStudent: Cents; validUntil: ISODate | null; receivedAt: ISODate
  paymentTerms: string | null; cancellation: string | null; services: Services; notes: string | null; status: 'ativa' | 'descartada'; updatedAt: string
}

export async function listAgencies(): Promise<{ agencies: AgencyRow[]; proposals: ProposalRow[] }> {
  const [a, p] = await Promise.all([
    db().from('agencies').select('id,nome,cnpj,cadastur,contato_nome,telefone,email,site,observacoes').order('nome'),
    db().from('proposals').select('id,agency_id,preco_aluno,validade,recebida_em,condicoes_pagamento,politica_cancelamento,servicos,observacoes,status,atualizado_em').order('recebida_em', { ascending: false }),
  ])
  if (a.error) throw friendly(a.error)
  if (p.error) throw friendly(p.error)
  return {
    agencies: a.data.map((r) => ({ id: r.id, name: r.nome, cnpj: r.cnpj, cadastur: r.cadastur, contactName: r.contato_nome, phone: r.telefone, email: r.email, site: r.site, notes: r.observacoes })),
    proposals: p.data.map((r) => ({
      id: r.id, agencyId: r.agency_id, pricePerStudent: Number(r.preco_aluno), validUntil: r.validade, receivedAt: r.recebida_em,
      paymentTerms: r.condicoes_pagamento, cancellation: r.politica_cancelamento, services: r.servicos ?? {}, notes: r.observacoes, status: r.status, updatedAt: r.atualizado_em,
    })),
  }
}

export type AgencyInput = Omit<AgencyRow, 'id'>
const nn = (s: string | null) => (s && s.trim() ? s.trim() : null)
const agencyDb = (a: AgencyInput) => ({
  nome: a.name.trim(), cnpj: a.cnpj ? cnpjDigits(a.cnpj) || null : null, cadastur: nn(a.cadastur), contato_nome: nn(a.contactName),
  telefone: nn(a.phone), email: nn(a.email), site: nn(a.site), observacoes: nn(a.notes),
})

export async function saveAgency(a: AgencyInput, id?: string): Promise<string> {
  const q = id ? db().from('agencies').update(agencyDb(a)).eq('id', id).select('id').single() : db().from('agencies').insert(agencyDb(a)).select('id').single()
  const { data, error } = await q
  if (error) throw friendly(error)
  return data.id as string
}

export type ProposalInput = Omit<ProposalRow, 'id' | 'updatedAt'>
const proposalDb = (p: ProposalInput) => ({
  agency_id: p.agencyId, preco_aluno: p.pricePerStudent, validade: p.validUntil || null, recebida_em: p.receivedAt,
  condicoes_pagamento: nn(p.paymentTerms), politica_cancelamento: nn(p.cancellation), servicos: p.services, observacoes: nn(p.notes), status: p.status,
})

export async function saveProposal(p: ProposalInput, id?: string): Promise<string> {
  const q = id ? db().from('proposals').update(proposalDb(p)).eq('id', id).select('id').single() : db().from('proposals').insert(proposalDb(p)).select('id').single()
  const { data, error } = await q
  if (error) throw friendly(error)
  return data.id as string
}
