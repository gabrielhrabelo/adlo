import { randomUUID } from "node:crypto"
import { AggregateRoot } from "../../../shared/domain/AggregateRoot.ts"
import { UserRegistered } from "./events.ts"

interface UserProps {
  id: string
  senhaHash: string
  nome: string
  email: string
  createdAt: Date
}

export class User extends AggregateRoot {
  private constructor(private readonly props: UserProps) {
    super()
  }

  static create(input: {
    nome: string
    email: string
    senhaHash: string
  }): User {
    const nome = input.nome.trim()

    const user = new User({
      id: randomUUID(),
      nome,
      email: input.email,
      senhaHash: input.senhaHash,
      createdAt: new Date()
    })

    user.addEvent(new UserRegistered(user.id, user.email))

    return user
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

  get createdAt() {
    return this.props.createdAt
  }


}
