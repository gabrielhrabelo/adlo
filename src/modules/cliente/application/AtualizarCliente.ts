import type { EventBus } from "../../../shared/application/EventBus.ts";
import type { ClienteRepository } from "../domain/ClienteRepository.ts";
import { ClienteNotFoundError, CpfCnpjEmUsoError } from "../domain/errors.ts";
import { toClienteDTO } from "./dto.ts";
import { parseDadosDoCliente, type DadosDoClienteInput } from "./input.ts";

export class AtualizarCliente {
  constructor(
    private readonly clientes: ClienteRepository,
    private readonly events: EventBus
  ) { }

  async execute(input: DadosDoClienteInput & { id: string }) {
    const cliente = await this.clientes.findById(input.id)

    if (!cliente) throw new ClienteNotFoundError()

    const dados = parseDadosDoCliente(input)

    if (dados.cpfCnpj && dados.cpfCnpj.value !== cliente.cpfCnpj) {
      const outro = await this.clientes.findByCpfCnpj(dados.cpfCnpj.value)
      if (outro && outro.id !== cliente.id) throw new CpfCnpjEmUsoError()
    }

    cliente.atualizar(dados)
    await this.clientes.save(cliente)
    await this.events.publish(cliente.pullEvents())

    return toClienteDTO(cliente)
  }
}
