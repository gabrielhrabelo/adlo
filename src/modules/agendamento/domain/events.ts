import type { DomainEvent } from "../../../shared/domain/DomainEvent.ts";

abstract class AgendamentoEvent implements DomainEvent {
  abstract readonly name: string
  readonly occurredAt = new Date()

  constructor(readonly agendamentoId: string) {

  }
}

export class AgendamentoIncluido extends AgendamentoEvent {
  readonly name = 'agendamento.incluido'
}

export class AgendamentoAlterado extends AgendamentoEvent {
  readonly name = 'agendamento.alterado'
}

export class AgendamentoConfirmado extends AgendamentoEvent {
  readonly name = 'agendamento.confirmado'
}

export class AgendamentoConcluido extends AgendamentoEvent {
  readonly name = 'agendamento.concluido'
}

export class AgendamentoCancelado extends AgendamentoEvent {
  readonly name = 'agendamento.cancelado'
}

export class AgendamentoExcluido extends AgendamentoEvent {
  readonly name = 'agendamento.excluido'
}
