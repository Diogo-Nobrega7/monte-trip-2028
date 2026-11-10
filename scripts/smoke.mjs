// Teste de fumaça: abre cada rota em desktop e celular, exercita interações reais,
// registra erros de console e tira capturas para revisão visual.
import { chromium } from 'playwright-core'
const BASE = process.env.BASE ?? 'http://localhost:4173/'
const routes = ['painel','alunos','mensalidades','arrecadacoes','despesas','simulador','viagem','agencias','documentos','configuracoes']
const browser = await chromium.launch({ executablePath: process.env.CHROME })
const errors = [], fails = []
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) fails.push(msg) }

for (const [name, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: name === 'mobile' ? 2 : 1 })
  page.on('console', (m) => m.type() === 'error' && !/ERR_NAME_NOT_RESOLVED/.test(m.text()) && errors.push(`${name}: ${m.text()}`))
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`))
  for (const r of routes) {
    await page.goto(`${BASE}#${r}`); await page.waitForTimeout(1000)
    const h1 = await page.locator('h1').first().textContent()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    check(!!h1 && !overflow, `${name} #${r} h1="${h1}"${overflow ? ' (rolagem horizontal)' : ''}`)
    await page.screenshot({ path: `shots/${name}-${r}.png`, fullPage: true })
  }
  if (name === 'desktop') {
    await page.goto(`${BASE}#painel`); await page.waitForTimeout(300)
    await page.locator('aside nav').getByText('Simulador').click(); await page.waitForTimeout(300)
    check(await page.evaluate(() => location.hash) === '#simulador', 'clique na sidebar navega')
    const big = page.locator('text=Saldo do grupo ao fim').locator('xpath=following-sibling::p[1]')
    const before = await big.textContent()
    await page.getByRole('button', { name: 'R$ 50' }).click(); await page.waitForTimeout(700)
    const after = await big.textContent()
    check(before !== after && after.includes('19.528'), `simulador recalcula: ${before} → ${after} (esperado R$ 19.528 com R$50)`)
    await page.getByRole('button', { name: 'Fixar cenário' }).click()
    await page.getByRole('button', { name: 'R$ 100' }).click()
    await page.getByRole('button', { name: 'Fixar cenário' }).click(); await page.waitForTimeout(300)
    check(await page.locator('td:has-text("Cenário")').count() === 2, 'dois cenários fixados na comparação')
    await page.screenshot({ path: 'shots/desktop-simulador-comparacao.png', fullPage: true })
    await page.goto(`${BASE}#alunos`); await page.waitForTimeout(300)
    await page.getByRole('button', { name: 'Cadastrar aluno' }).first().click(); await page.waitForTimeout(300)
    check(await page.getByRole('dialog').isVisible(), 'modal de cadastro abre')
    await page.screenshot({ path: 'shots/desktop-modal.png' })
    await page.keyboard.press('Escape'); await page.waitForTimeout(200)
    check(await page.getByRole('dialog').count() === 0, 'Esc fecha o modal')
    await page.locator('aside button[aria-haspopup=menu]').click()
    await page.getByRole('menuitemradio', { name: 'Tema escuro' }).click(); await page.waitForTimeout(400)
    check(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'tema escuro aplicado pelo menu do usuário')
    for (const r of ['painel', 'simulador', 'alunos']) { await page.goto(`${BASE}#${r}`); await page.waitForTimeout(1000); await page.screenshot({ path: `shots/desktop-${r}-dark.png`, fullPage: true }) }
  } else {
    await page.goto(`${BASE}#painel`); await page.waitForTimeout(300)
    await page.locator('nav[aria-label=Atalhos]').getByText('Simular').click(); await page.waitForTimeout(300)
    check(await page.evaluate(() => location.hash) === '#simulador', 'barra inferior navega')
    await page.locator('nav[aria-label=Atalhos]').getByText('Mais').click(); await page.waitForTimeout(400)
    await page.screenshot({ path: 'shots/mobile-menu.png' })
    await page.locator('aside nav').getByText('Despesas').click(); await page.waitForTimeout(400)
    check(await page.evaluate(() => location.hash) === '#despesas', 'menu "Mais" navega')
    await page.getByRole('button', { name: 'Registrar despesa' }).first().click(); await page.waitForTimeout(400)
    await page.screenshot({ path: 'shots/mobile-modal.png' })
  }
  await page.close()
}
await browser.close()
console.log(errors.length ? `ERROS DE CONSOLE:\n${errors.join('\n')}` : 'Nenhum erro de console ou de página.')
console.log(fails.length ? `${fails.length} verificação(ões) falharam` : 'Todas as verificações passaram.')
process.exit(fails.length || errors.length ? 1 : 0)
