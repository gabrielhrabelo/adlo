import type { EventBus } from "../../../shared/application/EventBus.ts";
import type { ClienteRepository } from "../domain/ClienteRepository.ts";
import { ClienteNotFoundError } from "../domain/errors.ts";
import { toClienteDTO } from "./dto.ts";

// RF05 - Inativar cliente (e reativar, conforme o diagrama de classes)
export class AlterarSituacaoDoCliente {
  constructor(
    private readonly clientes: ClienteRepository,
    private readonly events: EventBus
  ) { }

  async execute(input: { id: string, ativo: boolean }) {
    const cliente = await this.clientes.findById(input.id)

    if (!cliente) throw new ClienteNotFoundError()

    if (input.ativo) {
      cliente.ativar()
    } else {
      cliente.inativar()
    }
    await this.clientes.save(cliente)
    await this.events.publish(cliente.pullEvents())

    return toClienteDTO(cliente)
  }
}
