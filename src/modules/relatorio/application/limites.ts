export const LIMITE_DE_LINHAS = 5000

// Período máximo aceito nos relatórios por intervalo de datas
export const PERIODO_MAXIMO_DIAS = 366

// Avisa no PDF quando a consulta passou do limite de linhas
export function comObservacao(total: number): { observacao?: string } {
  return total > LIMITE_DE_LINHAS
    ? { observacao: `Exibindo apenas os primeiros ${LIMITE_DE_LINHAS.toLocaleString('pt-BR')} registros. Refine os filtros para ver o restante.` }
    : {}
}

export function resumoDeTotal(total: number): string {
  const exibidos = Math.min(total, LIMITE_DE_LINHAS)
  return `Total: ${exibidos.toLocaleString('pt-BR')}${total > LIMITE_DE_LINHAS ? '+' : ''} registro${exibidos === 1 ? '' : 's'}`
}

export function nomeDeArquivo(prefixo: string, hoje: string): string {
  return `relatorio-${prefixo}-${hoje}.pdf`
}
