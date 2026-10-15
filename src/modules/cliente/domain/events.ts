import type { DomainEvent } from "../../../shared/domain/DomainEvent.ts";

export class ClienteCadastrado implements DomainEvent {
  readonly name = 'cliente.cadastrado'
  readonly occurredAt = new Date()

  constructor(readonly clienteId: string) {

  }
}

export class ClienteAtualizado implements DomainEvent {
  readonly name = 'cliente.atualizado'
  readonly occurredAt = new Date()

  constructor(readonly clienteId: string) {

  }
}

export class ClienteInativado implements DomainEvent {
  readonly name = 'cliente.inativado'
  readonly occurredAt = new Date()

  constructor(readonly clienteId: string) {

  }
}

export class ClienteReativado implements DomainEvent {
  readonly name = 'cliente.reativado'
  readonly occurredAt = new Date()

  constructor(readonly clienteId: string) {

  }
}
