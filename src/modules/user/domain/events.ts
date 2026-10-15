import type { DomainEvent } from "../../../shared/domain/DomainEvent.ts";

export class UserRegistered implements DomainEvent {
  readonly name = 'user.user-registered'
  readonly occurredAt = new Date()

  constructor(readonly userId: string, readonly email: string) {

  }
}
