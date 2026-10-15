import type { DomainEvent } from "../../../shared/domain/DomainEvent.ts";
import type { StatusDoProcesso } from "./enums.ts";

export class ProcessoCadastrado implements DomainEvent {
  readonly name = 'processo.cadastrado'
  readonly occurredAt = new Date()

  constructor(readonly processoId: string, readonly clienteId: string) {

  }
}

export class ProcessoAtualizado implements DomainEvent {
  readonly name = 'processo.atualizado'
  readonly occurredAt = new Date()

  constructor(readonly processoId: string) {

  }
}

export class StatusDoProcessoAlterado implements DomainEvent {
  readonly name = 'processo.status-alterado'
  readonly occurredAt = new Date()

  constructor(readonly processoId: string, readonly de: StatusDoProcesso, readonly para: StatusDoProcesso) {

  }
}

export class ProcessoExcluido implements DomainEvent {
  readonly name = 'processo.excluido'
  readonly occurredAt = new Date()

  constructor(readonly processoId: string) {

  }
}
