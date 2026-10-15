import { NumeroProcessoInvalidoError } from "./errors.ts"

// Numeração única do CNJ (Resolução 65/2008): NNNNNNN-DD.AAAA.J.TR.OOOO,
// com dígito verificador DD calculado por módulo 97 (ISO 7064)
export class NumeroProcesso {
  private constructor(public readonly value: string) {

  }

  static create(raw: string): NumeroProcesso {
    const digits = raw.replace(/\D/g, '')

    if (digits.length !== 20) throw new NumeroProcessoInvalidoError(raw)

    const n = digits.slice(0, 7)
    const dd = digits.slice(7, 9)
    const aaaa = digits.slice(9, 13)
    const j = digits.slice(13, 14)
    const tr = digits.slice(14, 16)
    const oooo = digits.slice(16, 20)

    if (NumeroProcesso.digitoVerificador(n, aaaa, j, tr, oooo) !== dd) {
      throw new NumeroProcessoInvalidoError(raw)
    }
    return new NumeroProcesso(`${n}-${dd}.${aaaa}.${j}.${tr}.${oooo}`)
  }

  static digitoVerificador(n: string, aaaa: string, j: string, tr: string, oooo: string): string {
    const resto = BigInt(`${n}${aaaa}${j}${tr}${oooo}00`) % 97n
    return String(98n - resto).padStart(2, '0')
  }
}
