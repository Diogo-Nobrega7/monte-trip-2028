/** Texto padrão do aviso de etapa — mantém a mensagem consistente entre módulos. */
export const STAGE2 = 'A estrutura está pronta. Cadastro, edição e gravação em banco chegam nas próximas etapas.'

/** Aviso para páginas com dados de alunos quando o banco não está conectado ou o visitante não entrou. */
export function accessNotice(connected: boolean, canRead: boolean): string | null {
  if (!connected) return 'Modo demonstração: o banco ainda não foi conectado, então nada é gravado. Veja docs/PUBLICAR.md.'
  if (!canRead) return 'Dados dos alunos são de menores e ficam visíveis só para a administração. Os totais estão no Painel.'
  return null
}
