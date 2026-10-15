export type ErrorKind = 'validation' | 'unauthorized' | 'not_found' | 'conflict'

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly kind: ErrorKind = 'validation'
  ) {
    super(message)
    this.name = new.target.name
  }
}
