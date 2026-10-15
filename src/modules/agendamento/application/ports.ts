export type Clock = () => Date

export const systemClock: Clock = () => new Date()

// Consulta entidades de outros módulos que o agendamento referencia
export interface Referencias {
  cliente(id: string): Promise<{ ativo: boolean } | null>
  processo(id: string): Promise<{ clienteId: string } | null>
  usuario(id: string): Promise<{ ativo: boolean } | null>
}

export interface AlertaDeAgendamento {
  agendamentoId: string
  titulo: string
  tipo: 'PRAZO' | 'AUDIENCIA' | 'COMPROMISSO'
  dataHora: Date
  duracaoMinutos: number
  cliente: { id: string, nome: string }
  processo: { id: string, titulo: string, numeroProcesso: string | null } | null
  destinatario: { id: string, nome: string, email: string }
}

// RF14 - envio dos alertas (e-mail ou outro canal)
export interface Notificador {
  notificar(alerta: AlertaDeAgendamento): Promise<void>
}

export interface AlertaStore {
  // Agendamentos ativos cujo lembrete venceu e ainda não foram notificados
  pendentes(agora: Date, limite: number): Promise<AlertaDeAgendamento[]>
  // Reserva o envio de forma atômica (update condicional em notificadoEm IS NULL).
  // Retorna false se outra instância já reservou.
  reservar(agendamentoId: string, agora: Date): Promise<boolean>
  // Desfaz a reserva quando o envio falha, para tentar de novo no próximo ciclo
  liberar(agendamentoId: string, reservadoEm: Date): Promise<void>
}
