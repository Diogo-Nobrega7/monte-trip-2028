// Teste de ponta a ponta: navegador real + banco/API/Storage locais. Usa o sistema como Davi e a professora.
const { chromium } = require('playwright')
const fs = require('fs')
const E = __dirname
const OUT = process.env.OUT ?? require('os').tmpdir() + '/monte-e2e'
fs.mkdirSync(`${OUT}/shots`, { recursive: true })
const BASE = process.env.BASE ?? 'http://localhost:4173/'
const fails = [], errors = []
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) fails.push(msg) }
const nb = (s) => s.replace(/\u00a0/g, ' ')
const wait = (p, ms = 600) => p.waitForTimeout(ms)
const pad = (n) => String(n).padStart(2, '0')
const d = new Date(); d.setMonth(d.getMonth() - 2)
const START = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
  const page = await ctx.newPage()
  page.on('console', (m) => m.type() === 'error' && !/favicon|fonts\.g|status of 400/.test(m.text()) && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  const go = async (r) => { await page.goto(`${BASE}#${r}`); await wait(page, 1200) }
  const toast = async () => (await page.locator('[aria-live=polite]').innerText().then(nb)).trim()
  const dialog = () => page.getByRole('dialog').last()
  const shot = (n) => page.screenshot({ path: `${OUT}/shots/${n}.png`, fullPage: true })
  const logout = async () => { await page.evaluate(() => localStorage.clear()); await page.goto(BASE); await wait(page, 800) }
  const login = async (email, pw) => {
    await logout(); await go('entrar')
    await page.getByLabel('E-mail').fill(email); await page.getByLabel('Senha').fill(pw)
    await page.getByRole('button', { name: 'Entrar' }).click(); await wait(page, 1800)
  }

  // ------------------------------------------------ visitante
  await go('painel')
  check((await page.locator('body').innerText().then(nb)).includes('Saldo atual'), 'visitante vê o painel')
  await go('alunos')
  check((await page.locator('body').innerText().then(nb)).includes('visíveis só para a administração'), 'visitante não vê alunos (aviso de privacidade)')
  await login('davi@teste.local', 'senha-errada')
  check((await page.locator('body').innerText().then(nb)).includes('E-mail ou senha incorretos'), 'senha errada é recusada')

  // ------------------------------------------------ admin: alunos
  await login('davi@teste.local', 'senha-admin-123')
  await go('alunos')
  await page.getByRole('button', { name: 'Importar planilha' }).click(); await wait(page, 300)
  await page.locator('input[type=file]').setInputFiles(`${E}/arquivos/alunos.csv`); await wait(page, 800)
  const prev = await dialog().innerText().then(nb)
  check(prev.includes('2 prontos para importar') && prev.includes('Repetido no arquivo') && prev.includes('Data de adesão inválida'), 'importação: prévia valida, marca duplicado e erro')
  await shot('desktop-importacao')
  await dialog().getByRole('button', { name: /Importar 2 alunos/ }).click(); await wait(page, 1500)
  check((await toast()).includes('2 alunos importados'), 'importação grava só os válidos')
  await page.getByRole('button', { name: 'Cadastrar aluno' }).first().click(); await wait(page, 300)
  await dialog().getByLabel('Nome do aluno').fill('Carlos Teste'); await dialog().getByLabel('Responsável legal').fill('Rita Teste')
  await dialog().getByRole('button', { name: 'Salvar' }).click(); await wait(page, 1500)
  check((await page.locator('main').innerText().then(nb)).includes('Carlos Teste'), 'cadastro manual de aluno')
  await page.getByRole('button', { name: 'Editar Carlos Teste' }).first().click(); await wait(page, 300)
  await dialog().getByLabel('Contato do responsável').fill('84 98888-0000'); await dialog().getByRole('button', { name: 'Salvar' }).click(); await wait(page, 1500)
  check((await page.locator('main').innerText().then(nb)).includes('84 98888-0000'), 'edição de cadastro')
  await page.getByRole('button', { name: 'Histórico de Carlos Teste' }).first().click(); await wait(page, 1000)
  check((await dialog().innerText().then(nb)).includes('Alteração'), 'histórico do aluno mostra a alteração')
  await page.keyboard.press('Escape'); await wait(page, 300)

  // ------------------------------------------------ admin: configurações
  await go('configuracoes')
  await page.getByRole('button', { name: 'Editar' }).click(); await wait(page, 400)
  const f = dialog()
  await f.getByLabel('Destino', { exact: true }).fill('Fortaleza')
  await f.getByLabel(/^Mensalidade/).fill('120')
  await f.getByLabel(/Mês da 1ª parcela/).fill(START)
  await f.getByLabel(/Regras ainda provisórias/).uncheck()
  await f.getByLabel('Motivo da alteração').fill('Valores combinados na reunião de pais')
  const preview = await f.innerText().then(nb)
  check(preview.includes('Na hora') && preview.includes('Aguarda professor'), 'formulário mostra o que entra na hora e o que aguarda aprovação')
  await shot('desktop-config-editar')
  await f.getByRole('button', { name: 'Salvar' }).click(); await wait(page, 1800)
  const cfg = await page.locator('main').innerText().then(nb)
  check(cfg.includes('Fortaleza'), 'destino muda na hora')
  check(cfg.includes('aguardando o professor') && cfg.includes('R$ 100,00'), 'mensalidade continua R$ 100 até a aprovação; proposta pendente visível')
  await go('simulador')
  check((await page.locator('main').innerText().then(nb)).includes('Fortaleza') || (await page.locator('aside').innerText().then(nb)).includes('Fortaleza'), 'destino novo aparece no menu lateral')

  // ------------------------------------------------ professor aprova
  await login('prof@teste.local', 'senha-prof-123')
  await go('configuracoes')
  check(!(await page.getByRole('button', { name: 'Editar' }).count()), 'professor não vê botão de editar')
  await page.getByLabel('Observação (opcional)').fill('Aprovado em reunião')
  await page.getByRole('button', { name: 'Aprovar' }).click(); await wait(page, 1800)
  const ap = await page.locator('main').innerText().then(nb)
  check(ap.includes('R$ 120,00') && ap.includes('Regras aprovadas pelo professor'), 'professor aprova e a nova mensalidade entra em vigor')
  check(ap.includes('aprovada por Prof. Ana'), 'histórico registra quem aprovou')
  await shot('desktop-config-historico')
  await go('alunos')
  check(!(await page.getByRole('button', { name: 'Cadastrar aluno' }).count()), 'professor não cadastra alunos')

  // ------------------------------------------------ admin: mensalidades
  await login('davi@teste.local', 'senha-admin-123')
  await go('mensalidades')
  await page.getByRole('button', { name: 'Gerar parcelas' }).click(); await wait(page, 400)
  await dialog().getByRole('button', { name: 'Gerar' }).click(); await wait(page, 2000)
  check((await toast()).includes('54 criadas'), `gera 18 parcelas × 3 alunos (${await toast()})`)
  const parc = await page.locator('main').innerText().then(nb)
  check(parc.includes('Atrasada') && parc.includes('R$ 18,00'), 'parcelas vencidas aparecem atrasadas com adicional de 15% (R$ 18,00)')
  // pagamento distribuído
  await page.getByRole('button', { name: 'Registrar pagamento' }).click(); await wait(page, 400)
  await dialog().getByLabel('Aluno').selectOption({ label: 'Ana Souza' }); await wait(page, 200)
  await dialog().getByLabel('Valor recebido').fill('300'); await wait(page, 300)
  check((await dialog().innerText().then(nb)).includes('Como o valor será dividido'), 'prévia da divisão aparece')
  await dialog().getByRole('button', { name: /Salvar/ }).click(); await wait(page, 1800)
  check((await toast()).includes('dividido em'), `pagamento distribuído (${await toast()})`)
  // pagamento parcial numa parcela específica
  await page.getByRole('button', { name: 'Registrar pagamento' }).click(); await wait(page, 400)
  await dialog().getByLabel('Aluno').selectOption({ label: 'Bruno Lima' }); await wait(page, 200)
  const opts = await dialog().getByLabel('Parcela').locator('option').allInnerTexts()
  await dialog().getByLabel('Parcela').selectOption({ label: opts.find((o) => o.startsWith('Parcela 3/')) }); await wait(page, 200)
  await dialog().getByLabel('Valor recebido').fill('500'); await dialog().getByRole('button', { name: /Salvar/ }).click(); await wait(page, 800)
  check((await dialog().innerText().then(nb)).includes('aceita no máximo'), 'pagamento acima do saldo da parcela é barrado no formulário')
  await dialog().getByLabel('Valor recebido').fill('50'); await dialog().getByRole('button', { name: /Salvar/ }).click(); await wait(page, 1800)
  check((await toast()).includes('parcial'), 'pagamento parcial registrado')
  await page.getByRole('radio', { name: 'Parcelas' }).click(); await page.getByRole('radio', { name: 'Parciais' }).click(); await wait(page, 300)
  check((await page.locator('main').innerText().then(nb)).includes('Bruno Lima'), 'parcela com pagamento parcial aparece como Parcial, não como paga')
  await shot('desktop-mensalidades')
  // estorno
  await page.getByRole('radio', { name: 'Pagamentos' }).click(); await wait(page, 300)
  await page.getByRole('button', { name: 'Estornar' }).first().click(); await wait(page, 300)
  await dialog().getByLabel('Motivo').fill('Valor digitado errado'); await dialog().getByRole('button', { name: 'Confirmar estorno' }).click(); await wait(page, 1800)
  const pg = await page.locator('main').innerText().then(nb)
  check((await toast()).includes('Estorno registrado') && pg.includes('Estornado') && pg.includes('Estorno'), 'estorno preserva o original e lança o oposto')
  await page.getByRole('radio', { name: 'Por aluno' }).click(); await wait(page, 300)
  await page.getByRole('button', { name: 'Ver' }).first().click(); await wait(page, 600)
  check((await dialog().innerText().then(nb)).includes('Parcelas') && (await dialog().innerText().then(nb)).includes('Pagamentos'), 'histórico individual do aluno')
  await page.keyboard.press('Escape')

  // ------------------------------------------------ arrecadações
  await go('arrecadacoes')
  await page.getByRole('button', { name: 'Registrar ação' }).first().click(); await wait(page, 300)
  await dialog().getByLabel('Nome da ação').fill('Bazar de teste'); await dialog().getByLabel('Receita bruta').fill('500'); await dialog().getByLabel('Custos').fill('120')
  check((await dialog().innerText().then(nb)).includes('R$ 380,00'), 'lucro líquido calculado no formulário')
  await dialog().getByRole('button', { name: 'Salvar' }).click(); await wait(page, 1800)
  check((await page.locator('main').innerText().then(nb)).includes('R$ 380,00'), 'ação registrada com lucro líquido')
  await page.getByRole('button', { name: 'Lançamentos' }).first().click(); await wait(page, 500)
  await dialog().getByRole('button', { name: 'Estornar' }).last().click(); await wait(page, 300)
  await dialog().getByLabel('Motivo').fill('Custo lançado em dobro'); await dialog().getByRole('button', { name: 'Confirmar estorno' }).click(); await wait(page, 1800)
  check((await page.getByRole('dialog').first().innerText().then(nb)).includes('R$ 500,00'), 'estorno de custo: líquido volta a R$ 500')
  await page.keyboard.press('Escape'); await wait(page, 300)

  // ------------------------------------------------ despesas com comprovante
  await go('despesas')
  await page.getByRole('button', { name: 'Registrar despesa' }).first().click(); await wait(page, 300)
  await dialog().getByLabel('Descrição').fill('Sinal da agência'); await dialog().getByLabel('Valor').fill('150')
  await dialog().getByLabel('Justificativa').fill('Reserva das datas'); await dialog().locator('input[type=file]').setInputFiles(`${E}/arquivos/recibo.pdf`)
  await dialog().getByRole('button', { name: /Salvar/ }).click(); await wait(page, 2500)
  check((await toast()).includes('Despesa e comprovante registrados'), `despesa com comprovante (${await toast()})`)
  await page.getByRole('button', { name: 'Registrar despesa' }).first().click(); await wait(page, 300)
  await dialog().getByLabel('Descrição').fill('Material da rifa'); await dialog().getByLabel('Valor').fill('30'); await dialog().getByLabel('Justificativa').fill('Cartelas')
  await dialog().getByRole('button', { name: /Salvar/ }).click(); await wait(page, 1800)
  const dp = await page.locator('main').innerText().then(nb)
  check(dp.includes('Sem comprovante') && /Sem comprovante\s*1/.test(dp), 'indicador de despesa sem comprovante')
  const [signed] = await Promise.all([
    ctx.waitForEvent('response', (r) => /storage\/v1\/object\/sign\/.+token=/.test(r.url())),
    page.getByRole('button', { name: 'Ver' }).first().click()])
  check(signed.status() === 200, 'comprovante abre por link temporário assinado')
  await wait(page, 500); for (const p of ctx.pages()) if (p !== page) await p.close()
  await shot('desktop-despesas')

  // ------------------------------------------------ documentos
  await go('documentos')
  await page.getByRole('button', { name: 'Enviar arquivo' }).click(); await wait(page, 300)
  await dialog().locator('input[type=file]').setInputFiles(`${E}/arquivos/recibo.pdf`)
  await dialog().getByLabel('Título').fill('Regulamento da viagem'); await dialog().getByLabel('Acesso').selectOption('publico')
  await dialog().getByRole('button', { name: 'Enviar' }).click(); await wait(page, 2000)
  check((await page.locator('main').innerText().then(nb)).includes('Regulamento da viagem'), 'documento enviado e listado')
  await shot('desktop-documentos')

  // ------------------------------------------------ agências
  await go('agencias')
  for (const [name, cnpj] of [['Agência Sol', '11.222.333/0001-81'], ['Viagens Mar', '']]) {
    await page.getByRole('button', { name: 'Nova agência' }).click(); await wait(page, 300)
    await dialog().getByLabel('Nome').fill(name); if (cnpj) await dialog().getByLabel('CNPJ').fill(cnpj)
    await dialog().getByRole('button', { name: 'Salvar' }).click(); await wait(page, 1500)
  }
  await page.getByRole('button', { name: 'Nova agência' }).click(); await wait(page, 300)
  await dialog().getByLabel('Nome').fill('Agência CNPJ ruim'); await dialog().getByLabel('CNPJ').fill('11.222.333/0001-80')
  await dialog().getByRole('button', { name: 'Salvar' }).click(); await wait(page, 500)
  check((await dialog().innerText().then(nb)).includes('CNPJ inválido'), 'CNPJ inválido é recusado'); await page.keyboard.press('Escape'); await wait(page, 300)
  for (const [ag, price, inc] of [['Agência Sol', '2100', ['Transporte', 'Hospedagem', 'Ingressos']], ['Viagens Mar', '1980', ['Transporte']]]) {
    await page.getByRole('button', { name: 'Adicionar proposta' }).click(); await wait(page, 300)
    await dialog().getByLabel('Agência').selectOption({ label: ag }); await dialog().getByLabel('Preço por aluno').fill(price)
    for (const s of inc) await dialog().getByLabel(s, { exact: true }).check()
    await dialog().getByRole('button', { name: 'Salvar' }).click(); await wait(page, 1500)
  }
  const cmp = await page.locator('main').innerText().then(nb)
  check(cmp.includes('Agência Sol') && cmp.includes('Viagens Mar') && (await page.getByLabel('melhor neste critério').count()) >= 2, 'comparação lado a lado com destaques por critério')
  check(!/Vencedora|vencedora é/.test(cmp), 'nenhuma agência é declarada vencedora')
  await shot('desktop-agencias')

  // ------------------------------------------------ prestação de contas
  await go('relatorios')
  const rel = await page.locator('main').innerText().then(nb)
  // 300 (Ana) + 50 (Bruno) − estorno + 500 (bazar após estorno do custo) − 150 − 30
  check(rel.includes('Saldo final') && rel.includes('Ilustrativa'), 'prestação de contas com projeção rotulada')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Livro-caixa' }).click()])
  const csv = fs.readFileSync(await dl.path(), 'utf8')
  check(csv.startsWith('﻿Data;Tipo') && csv.includes('Despesa'), 'CSV do livro-caixa baixado no formato do Excel')
  const [pdfWin] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Gerar PDF' }).click()])
  await wait(page, 800)
  check((await pdfWin.content()).includes('Prestação de contas') && (await pdfWin.content()).includes('Projeção ilustrativa'), 'relatório para PDF gerado')
  await pdfWin.close()
  await shot('desktop-relatorios')

  // ------------------------------------------------ backup
  await go('configuracoes')
  const [bk] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Baixar cópia de segurança' }).click()])
  const backup = JSON.parse(fs.readFileSync(await bk.path(), 'utf8'))
  check(backup.formato === 'monte-trip-2028/backup' && backup.tabelas.students.length === 3 && backup.tabelas.installments.length === 54 && backup.tabelas.audit_log.length > 0, 'backup completo em JSON')
  fs.writeFileSync(`${OUT}/backup.json`, JSON.stringify(backup))

  // ------------------------------------------------ painel do admin
  await go('painel')
  const pn = await page.locator('main').innerText().then(nb)
  check(pn.includes('Regulamento publicado') && /mensalidades? em atraso/.test(pn) && pn.includes('despesa sem comprovante'), 'painel com pendências reais')
  await shot('desktop-painel-admin')

  // ------------------------------------------------ celular (admin)
  const m = await ctx.newPage(); await m.setViewportSize({ width: 390, height: 844 })
  m.on('pageerror', (e) => errors.push(`mobile: ${e.message}`))
  for (const r of ['painel', 'mensalidades', 'alunos', 'arrecadacoes', 'despesas', 'relatorios', 'agencias', 'documentos', 'configuracoes', 'viagem', 'simulador']) {
    await m.goto(`${BASE}#${r}`); await m.waitForTimeout(1300)
    const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    check(!overflow, `celular #${r} sem rolagem horizontal`)
    await m.screenshot({ path: `${OUT}/shots/mobile-${r}.png`, fullPage: true })
  }
  await m.goto(`${BASE}#mensalidades`); await m.waitForTimeout(1200)
  await m.getByRole('button', { name: 'Registrar pagamento' }).click(); await m.waitForTimeout(500)
  await m.screenshot({ path: `${OUT}/shots/mobile-pagamento.png` })
  await m.close()

  // ------------------------------------------------ visitante de novo
  await logout(); await go('painel')
  const vp = await page.locator('main').innerText().then(nb)
  check(vp.includes('Saldo atual') && !vp.includes('Ana Souza'), 'visitante vê totais e nenhum nome')
  await go('documentos')
  const vd = await page.locator('main').innerText().then(nb)
  check(vd.includes('Regulamento da viagem') && !vd.includes('Comprovante'), 'visitante vê só o documento público')
  await go('relatorios')
  check((await page.locator('main').innerText().then(nb)).includes('Saldo atual'), 'visitante vê a prestação de contas pública')
  await shot('desktop-visitante-relatorios')
  await go('mensalidades')
  const vm = await page.locator('main').innerText().then(nb)
  check(!vm.includes('Ana Souza') && !vm.includes('Total recebido'), 'visitante não vê mensalidades nem zeros enganosos')

  await browser.close()
  console.log(errors.length ? `ERROS DE CONSOLE:\n${[...new Set(errors)].join('\n')}` : 'Nenhum erro de console.')
  console.log(fails.length ? `${fails.length} verificação(ões) falharam` : 'Todas as verificações passaram.')
  process.exit(fails.length ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
