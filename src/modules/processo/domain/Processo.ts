import { randomUUID } from "node:crypto"
import { AggregateRoot } from "../../../shared/domain/AggregateRoot.ts"
import type { AreaDoProcesso, StatusDoProcesso } from "./enums.ts"
import { ProcessoInvalidoError } from "./errors.ts"
import { ProcessoAtualizado, ProcessoCadastrado, ProcessoExcluido, StatusDoProcessoAlterado } from "./events.ts"
import type { NumeroProcesso } from "./NumeroProcesso.ts"

export interface ProcessoProps {
  id: string
  clienteId: string
  numeroProcesso: string | null
  titulo: string
  area: AreaDoProcesso
  status: StatusDoProcesso
  tribunal: string | null
  descricao: string | null
  dataAbertura: Date
  createdAt: Date
}

export interface DadosDoProcesso {
  numeroProcesso?: NumeroProcesso | null
  titulo?: string
  area?: AreaDoProcesso
  tribunal?: string | null
  descricao?: string | null
  dataAbertura?: Date
}

export class Processo extends AggregateRoot {
  private constructor(private readonly props: ProcessoProps) {
    super()
  }

  static create(input: DadosDoProcesso & { clienteId: string, titulo: string, area: AreaDoProcesso, status?: StatusDoProcesso }): Processo {
    const processo = new Processo({
      id: randomUUID(),
      clienteId: input.clienteId,
      numeroProcesso: input.numeroProcesso?.value ?? null,
      titulo: Processo.validarTitulo(input.titulo),
      area: input.area,
      status: input.status ?? 'TRIAGEM',
      tribunal: input.tribunal?.trim() || null,
      descricao: input.descricao?.trim() || null,
      dataAbertura: Processo.validarAbertura(input.dataAbertura ?? hoje()),
      createdAt: new Date(),
    })

    processo.addEvent(new ProcessoCadastrado(processo.id, processo.clienteId))

    return processo
  }

  static restore(props: ProcessoProps, version: number): Processo {
    const processo = new Processo({ ...props })
    processo.markPersisted(version)

    return processo
  }

  atualizar(input: DadosDoProcesso): void {
    if (input.numeroProcesso !== undefined) this.props.numeroProcesso = input.numeroProcesso?.value ?? null
    if (input.titulo !== undefined) this.props.titulo = Processo.validarTitulo(input.titulo)
    if (input.area !== undefined) this.props.area = input.area
    if (input.tribunal !== undefined) this.props.tribunal = input.tribunal?.trim() || null
    if (input.descricao !== undefined) this.props.descricao = input.descricao?.trim() || null
    if (input.dataAbertura !== undefined) this.props.dataAbertura = Processo.validarAbertura(input.dataAbertura)

    this.addEvent(new ProcessoAtualizado(this.id))
  }

  // RF08 - Atualizar status do processo
  alterarStatus(status: StatusDoProcesso): void {
    if (status === this.props.status) return

    const anterior = this.props.status
    this.props.status = status
    this.addEvent(new StatusDoProcessoAlterado(this.id, anterior, status))
  }

  // "Inativar processo" (Figura 1): o processo vai para ARQUIVADO e sai das listas ativas
  arquivar(): void {
    this.alterarStatus('ARQUIVADO')
  }

  marcarExcluido(): void {
    this.addEvent(new ProcessoExcluido(this.id))
  }

  private static validarTitulo(raw: string): string {
    const titulo = raw.trim()

    if (titulo.length < 3 || titulo.length > 200) {
      throw new ProcessoInvalidoError('O título precisa ter entre 3 e 200 caracteres')
    }
    return titulo
  }

  private static validarAbertura(data: Date): Date {
    if (data.getTime() > Date.now()) {
      throw new ProcessoInvalidoError('A data de abertura não pode estar no futuro')
    }
    return data
  }

  get id() { return this.props.id }
  get clienteId() { return this.props.clienteId }
  get numeroProcesso() { return this.props.numeroProcesso }
  get titulo() { return this.props.titulo }
  get area() { return this.props.area }
  get status() { return this.props.status }
  get tribunal() { return this.props.tribunal }
  get descricao() { return this.props.descricao }
  get dataAbertura() { return this.props.dataAbertura }
  get createdAt() { return this.props.createdAt }
}

function hoje(): Date {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`)
}
