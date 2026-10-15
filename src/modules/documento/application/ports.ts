export type SituacaoDoCliente = 'ativo' | 'inativo' | 'nao_encontrado'

// Consultas a dados de outros módulos, implementadas pela infraestrutura deste módulo
export interface ReferenciasDoDocumento {
  situacaoDoCliente(clienteId: string): Promise<SituacaoDoCliente>
  ehAdvogado(usuarioId: string): Promise<boolean>
}

// Onde o conteúdo dos arquivos fica guardado (RNF03: criptografado em repouso)
export interface ArmazenamentoDeArquivos {
  salvar(chave: string, conteudo: Buffer): Promise<void>
  ler(chave: string): Promise<Buffer>
  // Não falha se o arquivo já não existir
  remover(chave: string): Promise<void>
}
