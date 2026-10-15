import { randomUUID } from "node:crypto"
import { AggregateRoot } from "../../../shared/domain/AggregateRoot.ts"
import {
  AgendamentoEncerradoError,
  AgendamentoInvalidoError,
  TransicaoDeStatusInvalidaError,
} from "./errors.ts"
import {
  AgendamentoAlterado,
  AgendamentoCancelado,
  AgendamentoConcluido,
  AgendamentoConfirmado,
  AgendamentoExcluido,
  AgendamentoIncluido,
} from "./events.ts"

export const TIPOS_AGENDAMENTO = ['PRAZO', 'AUDIENCIA', 'COMPROMISSO'] as const
export type TipoDeAgendamento = typeof TIPOS_AGENDAMENTO[number]

export const STATUS_AGENDAMENTO = ['PENDENTE', 'CONFIRMADO', 'CONCLUIDO', 'CANCELADO'] as const
export type StatusDoAgendamento = typeof STATUS_AGENDAMENTO[number]

export const STATUS_ATIVOS: readonly StatusDoAgendamento[] = ['PENDENTE', 'CONFIRMADO']

const MINUTO = 60 * 1000

// Antecedência padrão do alerta (RF14), quando o usuário não informa uma
export const ANTECEDENCIA_PADRAO_MINUTOS: Record<TipoDeAgendamento, number> = {
  PRAZO: 3 * 24 * 60,
  AUDIENCIA: 24 * 60,
  COMPROMISSO: 2 * 60,
}

export const DURACAO_MAXIMA_MINUTOS = 24 * 60
const ANTECEDENCIA_MAXIMA_MINUTOS = 90 * 24 * 60

export interface AgendamentoProps {
  id: string
  clienteId: string
  usuarioId: string
  processoId: string | null
  titulo: string
  tipo: TipoDeAgendamento
  status: StatusDoAgendamento
  dataHora: Date
  duracaoMinutos: number
  lembrarEm: Date | null
  notificadoEm: Date | null
  concluidoEm: Date | null
  createdAt: Date
}

export interface AlteracaoDeAgendamento {
  usuarioId?: string
  processoId?: string | null
  titulo?: string
  tipo?: TipoDeAgendamento
  dataHora?: Date
  duracaoMinutos?: number
  antecedenciaMinutos?: number
}

export class Agendamento extends AggregateRoot {
  private constructor(private readonly props: AgendamentoProps) {
    super()
  }

  static create(input: {
    clienteId: string
    usuarioId: string
    processoId?: string | null
    titulo: string
    tipo?: TipoDeAgendamento
    dataHora: Date
    duracaoMinutos?: number
    antecedenciaMinutos?: number
  }, agora: Date): Agendamento {
    const tipo = input.tipo ?? 'COMPROMISSO'
    const dataHora = Agendamento.validarDataHora(input.dataHora, agora)
    const antecedencia = Agendamento.validarAntecedencia(input.antecedenciaMinutos ?? ANTECEDENCIA_PADRAO_MINUTOS[tipo])

    const agendamento = new Agendamento({
      id: randomUUID(),
      clienteId: input.clienteId,
      usuarioId: input.usuarioId,
      processoId: input.processoId ?? null,
      titulo: Agendamento.validarTitulo(input.titulo),
      tipo,
      status: 'PENDENTE',
      dataHora,
      duracaoMinutos: Agendamento.validarDuracao(input.duracaoMinutos ?? 60),
      lembrarEm: new Date(dataHora.getTime() - antecedencia * MINUTO),
      notificadoEm: null,
      concluidoEm: null,
      createdAt: agora,
    })

    agendamento.addEvent(new AgendamentoIncluido(agendamento.id))

    return agendamento
  }

  static restore(props: AgendamentoProps, version: number): Agendamento {
    const agendamento = new Agendamento({ ...props })
    agendamento.markPersisted(version)

    return agendamento
  }

  alterar(input: AlteracaoDeAgendamento, agora: Date): void {
    this.garantirAtivo()

    const antecedenciaAtual = this.antecedenciaMinutos

    if (input.usuarioId !== undefined) this.props.usuarioId = input.usuarioId
    if (input.processoId !== undefined) this.props.processoId = input.processoId
    if (input.titulo !== undefined) this.props.titulo = Agendamento.validarTitulo(input.titulo)
    if (input.tipo !== undefined) this.props.tipo = input.tipo
    if (input.duracaoMinutos !== undefined) this.props.duracaoMinutos = Agendamento.validarDuracao(input.duracaoMinutos)
    if (input.dataHora !== undefined && input.dataHora.getTime() !== this.props.dataHora.getTime()) {
      this.props.dataHora = Agendamento.validarDataHora(input.dataHora, agora)
    }

    // Remarcar a data ou mudar a antecedência recalcula o lembrete e permite um novo alerta
    if (input.dataHora !== undefined || input.antecedenciaMinutos !== undefined) {
      const antecedencia = Agendamento.validarAntecedencia(input.antecedenciaMinutos ?? antecedenciaAtual)
      const lembrarEm = new Date(this.props.dataHora.getTime() - antecedencia * MINUTO)

      if (lembrarEm.getTime() !== this.props.lembrarEm?.getTime()) {
        this.props.lembrarEm = lembrarEm
        this.props.notificadoEm = null
      }
    }

    this.addEvent(new AgendamentoAlterado(this.id))
  }

  confirmar(): void {
    this.transicionar('CONFIRMADO', ['PENDENTE'])
    this.addEvent(new AgendamentoConfirmado(this.id))
  }

  concluir(agora: Date): void {
    this.transicionar('CONCLUIDO', STATUS_ATIVOS)
    this.props.concluidoEm = agora
    this.addEvent(new AgendamentoConcluido(this.id))
  }

  cancelar(): void {
    this.transicionar('CANCELADO', STATUS_ATIVOS)
    this.addEvent(new AgendamentoCancelado(this.id))
  }

  excluir(): void {
    this.addEvent(new AgendamentoExcluido(this.id))
  }

  // Prazos são datas-limite, não ocupam a agenda; agendamentos encerrados também não
  get ocupaAgenda(): boolean {
    return this.props.tipo !== 'PRAZO' && STATUS_ATIVOS.includes(this.props.status)
  }

  conflitaCom(outro: Agendamento): boolean {
    if (outro.id === this.id || outro.usuarioId !== this.usuarioId) return false
    if (!this.ocupaAgenda || !outro.ocupaAgenda) return false

    return this.inicio < outro.fim && outro.inicio < this.fim
  }

  private transicionar(para: StatusDoAgendamento, permitidosDe: readonly StatusDoAgendamento[]): void {
    if (!permitidosDe.includes(this.props.status)) {
      throw new TransicaoDeStatusInvalidaError(this.props.status, para)
    }
    this.props.status = para
  }

  private garantirAtivo(): void {
    if (!STATUS_ATIVOS.includes(this.props.status)) throw new AgendamentoEncerradoError()
  }

  private static validarTitulo(raw: string): string {
    const titulo = raw.trim()

    if (titulo.length < 2 || titulo.length > 200) {
      throw new AgendamentoInvalidoError('O título precisa ter entre 2 e 200 caracteres')
    }
    return titulo
  }

  private static validarDataHora(dataHora: Date, agora: Date): Date {
    if (Number.isNaN(dataHora.getTime())) throw new AgendamentoInvalidoError('Data e hora inválidas')
    if (dataHora.getTime() < agora.getTime()) {
      throw new AgendamentoInvalidoError('Não é possível agendar em uma data no passado')
    }
    return dataHora
  }

  private static validarDuracao(minutos: number): number {
    if (!Number.isInteger(minutos) || minutos < 1 || minutos > DURACAO_MAXIMA_MINUTOS) {
      throw new AgendamentoInvalidoError(`A duração precisa ser entre 1 e ${DURACAO_MAXIMA_MINUTOS} minutos`)
    }
    return minutos
  }

  private static validarAntecedencia(minutos: number): number {
    if (!Number.isInteger(minutos) || minutos < 0 || minutos > ANTECEDENCIA_MAXIMA_MINUTOS) {
      throw new AgendamentoInvalidoError('A antecedência do alerta precisa ser entre 0 e 90 dias (em minutos)')
    }
    return minutos
  }

  get id() { return this.props.id }
  get clienteId() { return this.props.clienteId }
  get usuarioId() { return this.props.usuarioId }
  get processoId() { return this.props.processoId }
  get titulo() { return this.props.titulo }
  get tipo() { return this.props.tipo }
  get status() { return this.props.status }
  get dataHora() { return this.props.dataHora }
  get duracaoMinutos() { return this.props.duracaoMinutos }
  get lembrarEm() { return this.props.lembrarEm }
  get notificadoEm() { return this.props.notificadoEm }
  get concluidoEm() { return this.props.concluidoEm }
  get createdAt() { return this.props.createdAt }

  get inicio(): number { return this.props.dataHora.getTime() }
  get fim(): number { return this.props.dataHora.getTime() + this.props.duracaoMinutos * MINUTO }

  get antecedenciaMinutos(): number {
    return this.props.lembrarEm
      ? Math.round((this.props.dataHora.getTime() - this.props.lembrarEm.getTime()) / MINUTO)
      : ANTECEDENCIA_PADRAO_MINUTOS[this.props.tipo]
  }
}
