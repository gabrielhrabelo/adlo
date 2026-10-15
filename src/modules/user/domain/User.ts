import { randomUUID } from "node:crypto"
import { AggregateRoot } from "../../../shared/domain/AggregateRoot.ts"
import { DomainError } from "../../../shared/domain/DomainError.ts"
import type { Email } from "../../../shared/domain/Email.ts"
import type { Papel } from "./Papel.ts"
import { UserPasswordChanged, UserRegistered, UserUpdated } from "./events.ts"

export interface UserProps {
  id: string
  nome: string
  email: string
  senhaHash: string
  papel: Papel
  ativo: boolean
  createdAt: Date
}

export class User extends AggregateRoot {
  private constructor(private readonly props: UserProps) {
    super()
  }

  static create(input: {
    nome: string
    email: Email
    senhaHash: string
    papel?: Papel
  }): User {
    const user = new User({
      id: randomUUID(),
      nome: User.validarNome(input.nome),
      email: input.email.value,
      senhaHash: input.senhaHash,
      papel: input.papel ?? 'ADVOGADO',
      ativo: true,
      createdAt: new Date()
    })

    user.addEvent(new UserRegistered(user.id, user.email))

    return user
  }

  static restore(props: UserProps, version: number): User {
    const user = new User({ ...props })
    user.markPersisted(version)

    return user
  }

  atualizar(input: { nome?: string, email?: Email }): void {
    if (input.nome !== undefined) {
      this.props.nome = User.validarNome(input.nome)
    }

    if (input.email !== undefined) {
      this.props.email = input.email.value
    }

    this.addEvent(new UserUpdated(this.id))
  }

  alterarSenha(novoHash: string): void {
    this.props.senhaHash = novoHash
    this.addEvent(new UserPasswordChanged(this.id))
  }

  private static validarNome(raw: string): string {
    const nome = raw.trim()

    if (nome.length < 2 || nome.length > 120) {
      throw new DomainError('O nome precisa ter entre 2 e 120 caracteres', 'INVALID_NAME', 'validation')
    }
    return nome
  }

  get id() {
    return this.props.id
  }

  get nome() {
    return this.props.nome
  }

  get email() {
    return this.props.email
  }

  get senhaHash() {
    return this.props.senhaHash
  }

  get papel() {
    return this.props.papel
  }

  get ativo() {
    return this.props.ativo
  }

  get createdAt() {
    return this.props.createdAt
  }
}
