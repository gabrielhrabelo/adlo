import { randomUUID } from "node:crypto"
import { AggregateRoot } from "../../../shared/domain/AggregateRoot.ts"
import type { Email } from "../../../shared/domain/Email.ts"
import type { Endereco, Telefone } from "./Contato.ts"
import type { CpfCnpj } from "./CpfCnpj.ts"
import { ClienteInvalidoError } from "./errors.ts"
import { ClienteAtualizado, ClienteCadastrado, ClienteInativado, ClienteReativado } from "./events.ts"

export interface ClienteProps {
  id: string
  usuarioId: string
  nome: string
  cpfCnpj: string | null
  email: string | null
  dataNascimento: Date | null
  observacoes: string | null
  ativo: boolean
  telefones: Telefone[]
  enderecos: Endereco[]
  createdAt: Date
}

export interface DadosDoCliente {
  usuarioId?: string
  nome?: string
  cpfCnpj?: CpfCnpj | null
  email?: Email | null
  dataNascimento?: Date | null
  observacoes?: string | null
  telefones?: Telefone[]
  enderecos?: Endereco[]
}

export class Cliente extends AggregateRoot {
  private constructor(private readonly props: ClienteProps) {
    super()
  }

  static create(input: DadosDoCliente & { usuarioId: string, nome: string }): Cliente {
    const cliente = new Cliente({
      id: randomUUID(),
      usuarioId: input.usuarioId,
      nome: Cliente.validarNome(input.nome),
      cpfCnpj: input.cpfCnpj?.value ?? null,
      email: input.email?.value ?? null,
      dataNascimento: Cliente.validarNascimento(input.dataNascimento ?? null),
      observacoes: input.observacoes?.trim() || null,
      ativo: true,
      telefones: input.telefones ?? [],
      enderecos: input.enderecos ?? [],
      createdAt: new Date(),
    })

    cliente.addEvent(new ClienteCadastrado(cliente.id))

    return cliente
  }

  static restore(props: ClienteProps, version: number): Cliente {
    const cliente = new Cliente({ ...props })
    cliente.markPersisted(version)

    return cliente
  }

  atualizar(input: DadosDoCliente): void {
    if (input.usuarioId !== undefined) this.props.usuarioId = input.usuarioId
    if (input.nome !== undefined) this.props.nome = Cliente.validarNome(input.nome)
    if (input.cpfCnpj !== undefined) this.props.cpfCnpj = input.cpfCnpj?.value ?? null
    if (input.email !== undefined) this.props.email = input.email?.value ?? null
    if (input.dataNascimento !== undefined) this.props.dataNascimento = Cliente.validarNascimento(input.dataNascimento)
    if (input.observacoes !== undefined) this.props.observacoes = input.observacoes?.trim() || null
    if (input.telefones !== undefined) this.props.telefones = input.telefones
    if (input.enderecos !== undefined) this.props.enderecos = input.enderecos

    this.addEvent(new ClienteAtualizado(this.id))
  }

  inativar(): void {
    if (!this.props.ativo) return

    this.props.ativo = false
    this.addEvent(new ClienteInativado(this.id))
  }

  ativar(): void {
    if (this.props.ativo) return

    this.props.ativo = true
    this.addEvent(new ClienteReativado(this.id))
  }

  private static validarNome(raw: string): string {
    const nome = raw.trim()

    if (nome.length < 2 || nome.length > 160) {
      throw new ClienteInvalidoError('O nome precisa ter entre 2 e 160 caracteres')
    }
    return nome
  }

  private static validarNascimento(data: Date | null): Date | null {
    if (data && data.getTime() > Date.now()) {
      throw new ClienteInvalidoError('Data de nascimento não pode estar no futuro')
    }
    return data
  }

  get id() { return this.props.id }
  get usuarioId() { return this.props.usuarioId }
  get nome() { return this.props.nome }
  get cpfCnpj() { return this.props.cpfCnpj }
  get email() { return this.props.email }
  get dataNascimento() { return this.props.dataNascimento }
  get observacoes() { return this.props.observacoes }
  get ativo() { return this.props.ativo }
  get telefones(): readonly Telefone[] { return this.props.telefones }
  get enderecos(): readonly Endereco[] { return this.props.enderecos }
  get createdAt() { return this.props.createdAt }
}
