export type SituacaoDoCliente = 'ativo' | 'inativo' | 'nao_encontrado'

export interface ClienteLookup {
  situacao(clienteId: string): Promise<SituacaoDoCliente>
}
