import { WeakPasswordError } from "./errors.ts"

export class Password {
  private constructor(public readonly value: string) {

  }

  static create(raw: string): Password {
    const ok = raw.length >= 8 && /[A-Za-z]/.test(raw) && /\d/.test(raw)

    if (!ok) {
      throw new WeakPasswordError()
    }
    return new Password(raw)
  }
}
