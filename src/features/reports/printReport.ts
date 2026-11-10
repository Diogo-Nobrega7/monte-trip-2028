import { money } from '@/lib/format'
import { rangeLabel, type Range } from '@/lib/period'
import { ORIGIN_LABEL, type LedgerEntry, type PeriodSummary } from '@/lib/ledger'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const br = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

/**
 * Relatório de prestação de contas pronto para imprimir ou salvar em PDF (janela de impressão do
 * navegador → "Salvar como PDF"). Só dados reais do banco; a projeção, quando incluída, vem rotulada.
 */
export function printReport(p: {
  title: string; range: Range; summary: PeriodSummary; byCategory: [string, number][]
  entries: (LedgerEntry & { balance: number; label: string })[]
  projection: { text: string } | null; generatedBy: string | null
}) {
  const s = p.summary
  const rows = (pairs: [string, number][]) => pairs.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">${money(v)}</td></tr>`).join('')
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(p.title)}</title>
<style>
  *{box-sizing:border-box} body{font:12px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#0B1530;margin:32px}
  h1{font-size:20px;margin:0} h2{font-size:14px;margin:24px 0 8px} .muted{color:#5A6478}
  table{width:100%;border-collapse:collapse} td,th{padding:5px 8px;border-bottom:1px solid #E3E7EF;text-align:left;vertical-align:top}
  th{font-size:11px;color:#5A6478;font-weight:600} .n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:16px} .box{border:1px solid #E3E7EF;border-radius:8px;padding:10px}
  .box b{display:block;font-size:16px;margin-top:2px} .neg{color:#B42318} .note{border:1px dashed #C9A227;border-radius:8px;padding:10px;margin-top:16px}
  footer{margin-top:28px;font-size:10px;color:#5A6478} @media print{body{margin:12mm} h2{break-after:avoid} tr{break-inside:avoid}}
</style></head><body>
<h1>${esc(p.title)}</h1>
<p class="muted">Período: ${esc(rangeLabel(p.range))} · Gerado em ${new Date().toLocaleString('pt-BR')}${p.generatedBy ? ` por ${esc(p.generatedBy)}` : ''}</p>
<div class="grid">
  <div class="box">Saldo inicial<b>${money(s.opening)}</b></div>
  <div class="box">Entradas<b>${money(s.inflow)}</b></div>
  <div class="box">Saídas<b>${money(s.outflow)}</b></div>
  <div class="box">Saldo final<b>${money(s.closing)}</b></div>
</div>
<h2>Resumo do período</h2>
<table><tbody>${rows([['Mensalidades recebidas (estornos descontados)', s.tuition], ['Arrecadações (receitas − custos)', s.fundraisingNet], ['Rendimentos (conforme extrato)', s.yields], ['Despesas', -s.expenses]])}
<tr><th>Resultado do período</th><th class="n">${money(s.inflow - s.outflow)}</th></tr></tbody></table>
${p.byCategory.length ? `<h2>Despesas por categoria</h2><table><tbody>${rows(p.byCategory)}</tbody></table>` : ''}
<h2>Movimentações (${p.entries.length})</h2>
${p.entries.length ? `<table><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th class="n">Valor</th><th class="n">Saldo</th></tr></thead><tbody>
${p.entries.map((e) => `<tr><td>${br(e.date)}</td><td>${esc(ORIGIN_LABEL[e.origin])}${e.reversal ? ' (estorno)' : ''}</td><td>${esc(e.label)}</td><td class="n ${e.amount < 0 ? 'neg' : ''}">${money(e.amount)}</td><td class="n">${money(e.balance)}</td></tr>`).join('')}
</tbody></table>` : '<p class="muted">Nenhuma movimentação no período.</p>'}
${p.projection ? `<div class="note"><b>Projeção ilustrativa (não é dado real):</b> ${esc(p.projection.text)}</div>` : ''}
<footer>Monte Trip 2028 · Valores registrados no sistema; lançamentos não são editados (correções aparecem como estornos). Confira com o extrato bancário.</footer>
<script>window.onload=()=>{window.print()}</script>
</body></html>`
  const w = window.open('', '_blank')
  if (!w) throw new Error('O navegador bloqueou a nova janela. Permita pop-ups para gerar o PDF.')
  w.document.open(); w.document.write(html); w.document.close()
}
