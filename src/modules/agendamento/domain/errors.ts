import { DomainError } from "../../../shared/domain/DomainError.ts";

export class AgendamentoNotFoundError extends DomainError {
  constructor() {
    super('Agendamento não encontrado', 'AGENDAMENTO_NOT_FOUND', 'not_found')
  }
}

export class AgendamentoInvalidoError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_AGENDAMENTO', 'validation')
  }
}

export class HorarioOcupadoError extends DomainError {
  constructor(readonly conflitos: { id: string, titulo: string, dataHora: string }[]) {
    super('O horário já está ocupado por outro agendamento do responsável', 'HORARIO_OCUPADO', 'conflict')
  }
}

export class TransicaoDeStatusInvalidaError extends DomainError {
  constructor(de: string, para: string) {
    super(`Não é possível passar o agendamento de ${de} para ${para}`, 'INVALID_STATUS_TRANSITION', 'conflict')
  }
}

export class AgendamentoEncerradoError extends DomainError {
  constructor() {
    super('Agendamentos concluídos ou cancelados não podem ser alterados', 'AGENDAMENTO_ENCERRADO', 'conflict')
  }
}

export class ReferenciaNaoEncontradaError extends DomainError {
  constructor(entidade: 'Cliente' | 'Processo' | 'Usuário') {
    super(`${entidade} não encontrado`, 'REFERENCIA_NOT_FOUND', 'not_found')
  }
}
