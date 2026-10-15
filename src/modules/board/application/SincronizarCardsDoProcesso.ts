import type { EventBus } from "../../../shared/application/EventBus.ts";
import type { BoardRepository } from "../domain/BoardRepository.ts";
import type { StatusDoProcesso } from "../domain/StatusDoProcesso.ts";

// Quando o status do processo muda fora do kanban (ex.: PATCH /processos/:id/status),
// move os cards do processo para a coluna vinculada ao novo status
export class SincronizarCardsDoProcesso {
  constructor(
    private readonly boards: BoardRepository,
    private readonly events: EventBus
  ) { }

  async execute(input: { processoId: string, status: StatusDoProcesso }): Promise<void> {
    for (const board of await this.boards.findByProcesso(input.processoId)) {
      if (!board.sincronizarProcesso(input.processoId, input.status)) continue

      await this.boards.save(board)
      await this.events.publish(board.pullEvents())
    }
  }
}
