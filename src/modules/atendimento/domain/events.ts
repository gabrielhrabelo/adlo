import type { DomainEvent } from "../../../shared/domain/DomainEvent.ts";

export class AtendimentoRegistrado implements DomainEvent {
  readonly name = 'atendimento.registrado'
  readonly occurredAt = new Date()

  constructor(readonly atendimentoId: string, readonly clienteId: string) {

  }
}

export class AtendimentoExcluido implements DomainEvent {
  readonly name = 'atendimento.excluido'
  readonly occurredAt = new Date()

  constructor(readonly atendimentoId: string, readonly clienteId: string) {

  }
}
