import type { DomainEvent } from './DomainEvent.ts'

export abstract class AggregateRoot {
  private events: DomainEvent[] = []
  private persistedVersion = 0

  protected addEvent(event: DomainEvent): void {
    this.events.push(event)
  }

  pullEvents(): DomainEvent[] {
    const pending = this.events
    this.events = []

    return pending
  }

  get version(): number { return this.persistedVersion }

  markPersisted(version: number) {
    this.persistedVersion = version
  }
}
