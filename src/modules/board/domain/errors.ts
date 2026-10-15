import { DomainError } from "../../../shared/domain/DomainError.ts";

export class BoardNotFoundError extends DomainError {
  constructor() {
    super('Board não encontrado', 'BOARD_NOT_FOUND', 'not_found')
  }
}

export class BoardInvalidoError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_BOARD', 'validation')
  }
}

export class ColunaNotFoundError extends DomainError {
  constructor() {
    super('Coluna não encontrada', 'COLUNA_NOT_FOUND', 'not_found')
  }
}

export class CardNotFoundError extends DomainError {
  constructor() {
    super('Card não encontrado', 'CARD_NOT_FOUND', 'not_found')
  }
}

export class ColunaComCardsError extends DomainError {
  constructor() {
    super('A coluna possui cards; mova-os ou exclua-os antes de excluir a coluna', 'COLUNA_COM_CARDS', 'conflict')
  }
}

export class ProcessoJaNoBoardError extends DomainError {
  constructor() {
    super('Este processo já possui um card neste board', 'PROCESSO_JA_NO_BOARD', 'conflict')
  }
}

export class ProcessoDoCardNotFoundError extends DomainError {
  constructor() {
    super('Processo não encontrado', 'PROCESSO_NOT_FOUND', 'not_found')
  }
}
