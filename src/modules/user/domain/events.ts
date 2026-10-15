import type { DomainEvent } from "../../../shared/domain/DomainEvent.ts";

export class UserRegistered implements DomainEvent {
  readonly name = 'user.user-registered'
  readonly occurredAt = new Date()

  constructor(readonly userId: string, readonly email: string) {

  }
}

export class UserUpdated implements DomainEvent {
  readonly name = 'user.user-updated'
  readonly occurredAt = new Date()

  constructor(readonly userId: string) {

  }
}

export class UserPasswordChanged implements DomainEvent {
  readonly name = 'user.password-changed'
  readonly occurredAt = new Date()

  constructor(readonly userId: string) {

  }
}
