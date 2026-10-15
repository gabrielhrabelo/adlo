import { DomainError } from "../../../shared/domain/DomainError.ts";

export class ProcessoNotFoundError extends DomainError {
  constructor() {
    super('Processo não encontrado', 'PROCESSO_NOT_FOUND', 'not_found')
  }
}

export class ProcessoInvalidoError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_PROCESSO', 'validation')
  }
}

export class NumeroProcessoInvalidoError extends DomainError {
  constructor(value: string) {
    super(`Número de processo inválido (padrão CNJ NNNNNNN-DD.AAAA.J.TR.OOOO): "${value}"`, 'INVALID_NUMERO_PROCESSO', 'validation')
  }
}

export class NumeroProcessoEmUsoError extends DomainError {
  constructor() {
    super('Já existe um processo com este número', 'NUMERO_PROCESSO_IN_USE', 'conflict')
  }
}

export class ClienteDoProcessoInvalidoError extends DomainError {
  constructor(motivo: 'nao_encontrado' | 'inativo') {
    super(
      motivo === 'inativo' ? 'O cliente está inativo' : 'Cliente não encontrado',
      motivo === 'inativo' ? 'CLIENTE_INATIVO' : 'CLIENTE_NOT_FOUND',
      motivo === 'inativo' ? 'conflict' : 'not_found'
    )
  }
}

export class ProcessoComVinculosError extends DomainError {
  constructor() {
    super(
      'O processo possui agendamentos ou atendimentos registrados e não pode ser excluído; arquive-o',
      'PROCESSO_COM_VINCULOS',
      'conflict'
    )
  }
}
