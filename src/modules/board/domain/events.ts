import type { DomainEvent } from "../../../shared/domain/DomainEvent.ts";

abstract class BoardEvent implements DomainEvent {
  abstract readonly name: string
  readonly occurredAt = new Date()

  constructor(readonly boardId: string) {

  }
}

export class BoardCriado extends BoardEvent {
  readonly name = 'board.criado'
}

export class BoardAlterado extends BoardEvent {
  readonly name = 'board.alterado'
}

export class BoardExcluido extends BoardEvent {
  readonly name = 'board.excluido'
}

export class CardMovido implements DomainEvent {
  readonly name = 'board.card-movido'
  readonly occurredAt = new Date()

  constructor(
    readonly boardId: string,
    readonly cardId: string,
    readonly processoId: string,
    readonly deColunaId: string,
    readonly paraColunaId: string,
  ) {

  }
}
