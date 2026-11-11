import { money } from '@/lib/format'

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
export const br = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

const BASE_CSS = `*{box-sizing:border-box} body{font:12px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#0B1530;margin:32px}
h1{font-size:20px;margin:0} h2{font-size:14px;margin:22px 0 8px} .muted{color:#5A6478}
table{width:100%;border-collapse:collapse} td,th{padding:6px 8px;border-bottom:1px solid #E3E7EF;text-align:left;vertical-align:top}
th{font-size:11px;color:#5A6478;font-weight:600} .n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:16px} .box{border:1px solid #E3E7EF;border-radius:8px;padding:10px}
.box b{display:block;font-size:16px;margin-top:2px} .warn{color:#B42318} footer{margin-top:28px;font-size:10px;color:#5A6478}
@media print{body{margin:12mm} tr{break-inside:avoid}}`

/** Abre uma janela com o documento e chama a impressão (o usuário escolhe "Salvar como PDF"). */
export function openPrint(title: string, body: string, css = '') {
  const w = window.open('', '_blank')
  if (!w) throw new Error('O navegador bloqueou a nova janela. Permita pop-ups para gerar o PDF.')
  w.document.open()
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${BASE_CSS}${css}</style></head><body>${body}<script>window.onload=()=>{window.print()}<\/script></body></html>`)
  w.document.close()
}

/** Recibo de um pagamento (só pagamentos válidos, nunca estornados). */
export function printReceipt(p: {
  id: string; studentName: string; guardianName: string | null; amount: number; paidAt: string; method: string
  reference: string; note: string | null; createdAt: string; admin: string
}) {
  const code = p.id.slice(0, 8).toUpperCase()
  openPrint(`Recibo ${code}`, `
<div class="rec">
  <header><div><h1>Recibo</h1><p class="muted">Monte Trip 2028 · Viagem de formatura do 3º ano · Colégio Monte</p></div>
  <div class="code"><span class="muted">Nº</span> ${code}</div></header>
  <div class="amount">${money(p.amount)}</div>
  <p class="txt">Recebemos${p.guardianName ? ` de <b>${esc(p.guardianName)}</b>,` : ''} referente ao aluno(a) <b>${esc(p.studentName)}</b>,
  a quantia de <b>${money(p.amount)}</b>, como ${esc(p.reference)}.</p>
  <table>
    <tr><th>Data do pagamento</th><td>${br(p.paidAt)}</td></tr>
    <tr><th>Forma</th><td>${esc(p.method)}</td></tr>
    <tr><th>Referente a</th><td>${esc(p.reference)}</td></tr>
    ${p.note ? `<tr><th>Observação</th><td>${esc(p.note)}</td></tr>` : ''}
    <tr><th>Lançamento</th><td style="font-family:ui-monospace,monospace;font-size:11px">${esc(p.id)}</td></tr>
    <tr><th>Registrado no sistema em</th><td>${new Date(p.createdAt).toLocaleString('pt-BR')}</td></tr>
  </table>
  <div class="sign"><div></div><p>${esc(p.admin)}<br><span class="muted">Administração do fundo</span></p></div>
  <footer>Emitido em ${new Date().toLocaleString('pt-BR')}. O código do lançamento identifica este pagamento no sistema; estornos aparecem no histórico do aluno.</footer>
</div>`, `.rec{max-width:640px;margin:0 auto;border:1px solid #E3E7EF;border-radius:14px;padding:28px}
header{display:flex;justify-content:space-between;align-items:flex-start} .code{font:600 14px/1 ui-monospace,monospace;background:#F6F8FC;padding:8px 10px;border-radius:8px}
.amount{font-size:34px;font-weight:800;margin:22px 0 8px;letter-spacing:-.02em} .txt{font-size:14px;line-height:1.6;margin-bottom:16px}
th{width:42%} .sign{margin-top:48px;display:flex;justify-content:flex-end} .sign p{border-top:1px solid #0B1530;padding-top:6px;min-width:240px;text-align:center}`)
}
