import { DomainError } from "../../../shared/domain/DomainError.ts";

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

export class InvalidTokenError extends DomainError {
  constructor() {
    super('Token de acesso inválido ou expirado', 'INVALID_TOKEN', 'unauthorized')
  }
}

export class ForbiddenError extends DomainError {
  constructor() {
    super('Você não tem permissão para esta operação', 'FORBIDDEN', 'forbidden')
  }
}

export { InvalidEmailError } from "../../../shared/domain/Email.ts";
