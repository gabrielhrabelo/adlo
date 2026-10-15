import { CpfCnpjInvalidoError } from "./errors.ts"

// Guarda apenas os dígitos; valida os dígitos verificadores de CPF (11) e CNPJ (14)
export class CpfCnpj {
  private constructor(public readonly value: string) {

  }

  static create(raw: string): CpfCnpj {
    const digits = raw.replace(/\D/g, '')
    const valido = digits.length === 11 ? cpfValido(digits) : digits.length === 14 ? cnpjValido(digits) : false

    if (!valido) throw new CpfCnpjInvalidoError(raw)

    return new CpfCnpj(digits)
  }

  get tipo(): 'CPF' | 'CNPJ' {
    return this.value.length === 11 ? 'CPF' : 'CNPJ'
  }
}

function cpfValido(cpf: string): boolean {
  if (/^(\d)\1{10}$/.test(cpf)) return false

  const dv = (len: number) => {
    let soma = 0
    for (let i = 0; i < len; i++) soma += Number(cpf[i]) * (len + 1 - i)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  return dv(9) === Number(cpf[9]) && dv(10) === Number(cpf[10])
}

function cnpjValido(cnpj: string): boolean {
  if (/^(\d)\1{13}$/.test(cnpj)) return false

  const dv = (len: number) => {
    const pesos = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let soma = 0
    for (let i = 0; i < len; i++) soma += Number(cnpj[i]) * pesos[i]!
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  return dv(12) === Number(cnpj[12]) && dv(13) === Number(cnpj[13])
}
