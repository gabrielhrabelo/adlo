import { DomainError } from "../../../shared/domain/DomainError.ts";

export class ClienteNotFoundError extends DomainError {
  constructor() {
    super('Cliente não encontrado', 'CLIENTE_NOT_FOUND', 'not_found')
  }
}

export class CpfCnpjInvalidoError extends DomainError {
  constructor(value: string) {
    super(`CPF/CNPJ inválido: "${value}"`, 'INVALID_CPF_CNPJ', 'validation')
  }
}

export class CpfCnpjEmUsoError extends DomainError {
  constructor() {
    super('Já existe um cliente com este CPF/CNPJ', 'CPF_CNPJ_IN_USE', 'conflict')
  }
}

export class ClienteInvalidoError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_CLIENTE', 'validation')
  }
}

export class ClienteInativoError extends DomainError {
  constructor() {
    super('Cliente está inativo', 'CLIENTE_INATIVO', 'conflict')
  }
}
