import type { Cents, ISODate } from '@/types/domain'

/** Serviços comparados em toda proposta (mesmas chaves de servicos_validos() no banco). */
export const SERVICES = ['transporte', 'hospedagem', 'ingressos', 'alimentacao', 'seguro', 'monitoramento'] as const
export type ServiceKey = (typeof SERVICES)[number]
export const SERVICE_LABEL: Record<ServiceKey, string> = {
  transporte: 'Transporte', hospedagem: 'Hospedagem', ingressos: 'Ingressos', alimentacao: 'Alimentação',
  seguro: 'Seguro-viagem', monitoramento: 'Monitores',
}
export type Services = Partial<Record<ServiceKey, { incluso: boolean; detalhe?: string | null }>>

export interface ProposalLike { id: string; pricePerStudent: Cents; validUntil: ISODate | null; services: Services; status: 'ativa' | 'descartada' }

export const includedCount = (s: Services) => SERVICES.filter((k) => s[k]?.incluso).length

/**
 * Melhor proposta em cada critério, entre as ativas. Empates destacam todas as empatadas.
 * Não existe "vencedora geral": a escolha considera fatores que o sistema não mede.
 */
export function bestByCriterion(proposals: ProposalLike[], today: ISODate) {
  const active = proposals.filter((p) => p.status === 'ativa')
  const ids = (pred: (p: ProposalLike) => boolean) => new Set(active.filter(pred).map((p) => p.id))
  const minPrice = Math.min(...active.map((p) => p.pricePerStudent))
  const maxIncluded = Math.max(0, ...active.map((p) => includedCount(p.services)))
  const valid = active.filter((p) => p.validUntil && p.validUntil >= today)
  const maxValidity = valid.map((p) => p.validUntil!).sort().at(-1)
  return {
    price: active.length ? ids((p) => p.pricePerStudent === minPrice) : new Set<string>(),
    included: maxIncluded > 0 ? ids((p) => includedCount(p.services) === maxIncluded) : new Set<string>(),
    validity: maxValidity ? ids((p) => p.validUntil === maxValidity) : new Set<string>(),
    services: Object.fromEntries(SERVICES.map((k) => [k, ids((p) => !!p.services[k]?.incluso)])) as Record<ServiceKey, Set<string>>,
    expired: ids((p) => !!p.validUntil && p.validUntil < today),
  }
}
