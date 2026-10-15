import type { DomainEvent } from "../domain/DomainEvent.ts";

export interface EventBus {
  publish(events: DomainEvent[]): Promise<void>
  subscribe<E extends DomainEvent>(name: string, handler: (event: E) => Promise<void>): void
}
