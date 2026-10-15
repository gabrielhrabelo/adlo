import { DomainError } from "./DomainError.ts"

export class InvalidEmailError extends DomainError {
  constructor(value: string) {
    super(`Email inválido: "${value}"`, `INVALID_EMAIL`, 'validation')
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class Email {
  private constructor(public readonly value: string) {

  }

  static create(raw: string): Email {
    const value = Email.normalize(raw)

    if (value.length > 254 || !EMAIL_REGEX.test(value)) {
      throw new InvalidEmailError(raw)
    }
    return new Email(value)
  }

  static normalize(raw: string): string {
    return raw.trim().toLowerCase()
  }
}
