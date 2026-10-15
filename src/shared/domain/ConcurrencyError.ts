import { DomainError } from "./DomainError.ts";

export class ConcurrencyError extends DomainError {
  constructor(aggregate: string) {
    super(`${aggregate} foi alterado por outra operação, tente novamente`, 'CONCURRENT_MODIFICATION', 'conflict')
  }
}
