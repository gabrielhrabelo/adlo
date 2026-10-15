import { DomainError } from "../../../shared/domain/DomainError.ts";

export class InvalidEmailError extends DomainError {
  constructor(value: string) {
    super(`Email inválido: "${value}"`, `INVALID_EMAIL`, 'validation')
  }
}

export class WeakPasswordError extends DomainError {
  constructor() {
    super(`A senha precisa ter 8+ caracteres, com letras e números`, `WEAK_PASSWORD`, 'validation')
  }
}

export class EmailAlreadyInUseError extends DomainError {
  constructor() {
    super(`Email já está em uso`, `EMAIL_IN_USE`, 'conflict')
  }
}

export class InvalidCredentialsError extends DomainError {
  constructor() {
   super(`Credenciais inválidas`, 'INVALID_CREDENTIALS', 'unauthorized')
  }
}

export class UserNotFoundError extends DomainError {
  constructor() {
    super('Usuário não encontrado', 'USER_NOT_FOUND', 'not_found')
  }
}
