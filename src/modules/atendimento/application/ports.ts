// Consultas a dados de outros módulos, implementadas pela infraestrutura deste módulo
export interface ReferenciasDoAtendimento {
  clienteExiste(clienteId: string): Promise<boolean>
  // null quando o processo não existe
  clienteDoProcesso(processoId: string): Promise<string | null>
  ehAdvogado(usuarioId: string): Promise<boolean>
}
