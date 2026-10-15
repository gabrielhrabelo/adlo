import { DomainError } from "../../../shared/domain/DomainError.ts";

export class FiltroDeRelatorioInvalidoError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_REPORT_FILTER', 'validation')
  }
}
