import type { DomainEvent } from "../../../shared/domain/DomainEvent.ts";

export class DocumentoAnexado implements DomainEvent {
  readonly name = 'documento.anexado'
  readonly occurredAt = new Date()

  constructor(readonly documentoId: string, readonly clienteId: string) {

  }
}

export class DocumentoRemovido implements DomainEvent {
  readonly name = 'documento.removido'
  readonly occurredAt = new Date()

  constructor(readonly documentoId: string, readonly clienteId: string) {

  }
}
