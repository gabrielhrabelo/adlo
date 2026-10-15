import { DomainError } from "../../../shared/domain/DomainError.ts";

export class AtendimentoNotFoundError extends DomainError {
  constructor() {
    super('Atendimento não encontrado', 'ATENDIMENTO_NOT_FOUND', 'not_found')
  }
}

export class AtendimentoInvalidoError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_ATENDIMENTO', 'validation')
  }
}

export class ClienteDoAtendimentoNotFoundError extends DomainError {
  constructor() {
    super('Cliente não encontrado', 'CLIENTE_NOT_FOUND', 'not_found')
  }
}

export class ProcessoDeOutroClienteError extends DomainError {
  constructor() {
    super('O processo informado não pertence a este cliente', 'PROCESSO_DE_OUTRO_CLIENTE', 'validation')
  }
}

export class ExclusaoDeAtendimentoNaoPermitidaError extends DomainError {
  constructor() {
    super('Somente o autor ou um advogado pode excluir este atendimento', 'FORBIDDEN', 'forbidden')
  }
}
