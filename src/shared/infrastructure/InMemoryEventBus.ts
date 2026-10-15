import type { EventBus } from "../application/EventBus.ts";
import type { DomainEvent } from "../domain/DomainEvent.ts";

type Handler = (event: DomainEvent) => Promise<void>

export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, Handler[]>()

  async publish(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      for (const handler of this.handlers.get(event.name) ?? []) {
        await handler(event)
      }
    }
  }

  subscribe<E extends DomainEvent>(name: string, handler: (event: E) => Promise<void>): void {
    const list = this.handlers.get(name) ?? []
    list.push(handler as Handler)
    this.handlers.set(name, list)
  }
}
