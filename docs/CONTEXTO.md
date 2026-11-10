# Contexto e decisões das conversas iniciais

## Sobre o projeto
- Viagem de formatura do 3º ano do Ensino Médio do Colégio Monte, Natal/RN, prevista para 2028.
- Cenário inicial: ~20 alunos, Beach Park (Aquiraz/CE), 4 dias e 3 noites. Destino, número de alunos e custos podem mudar.
- Arrecadação coletiva: mensalidades voluntárias + vendas, eventos, doações, patrocínios (rifas só se a escola permitir).
- Dinheiro registrado, acompanhado e, se possível, investido de forma conservadora, com transparência.
- Supervisão de um professor da escola. Idealizador e administrador: Davi.
- Objetivo: plataforma própria de gestão (não planilha), usada ao longo dos próximos anos.

## Pontos de atenção levantados
- **LGPD / menores:** alunos são menores. Dados pessoais exigem consentimento dos responsáveis,
  coleta mínima e acesso restrito. Documentos pessoais nunca públicos.
- **Rifas:** sem autorização podem configurar contravenção (loteria não autorizada), mesmo como
  "ação entre amigos". Validar com a escola; priorizar vendas e eventos.
- **Conta e investimento:** a plataforma registra e presta contas, não guarda dinheiro. Definir em nome
  de quem fica a conta e quem assina. Aplicações de baixo risco e liquidez diária (Tesouro Selic, CDB DI).
  Rendimento é registrado a partir do extrato, nunca calculado e lançado como real.

## Preferências de trabalho do usuário
- Desenvolvimento incremental, uma etapa por sessão, sem consumir contexto à toa.
- Executar, testar e verificar no navegador; registrar progresso em CLAUDE.md e docs/PROGRESSO.md.
- Respostas diretas, formatação simples.
- Visual premium (referências: Linear, Stripe, Vercel), identidade própria, sem dashboard genérico.

## Pendências que dependem do usuário (bloqueiam a etapa 2)
1. Criar projeto no Supabase (região São Paulo, plano Free) e fornecer Project URL + publishable key
   (sb_publishable_…) em `.env.local`. Nunca usar secret key nem senha do banco no frontend.
2. Nome e e-mail do administrador (Davi?) e do professor supervisor.
