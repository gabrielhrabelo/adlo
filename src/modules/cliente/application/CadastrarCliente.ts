import type { EventBus } from "../../../shared/application/EventBus.ts";
import { Cliente } from "../domain/Cliente.ts";
import type { ClienteRepository } from "../domain/ClienteRepository.ts";
import { CpfCnpjEmUsoError } from "../domain/errors.ts";
import { toClienteDTO } from "./dto.ts";
import { parseDadosDoCliente, type DadosDoClienteInput } from "./input.ts";

export class CadastrarCliente {
  constructor(
    private readonly clientes: ClienteRepository,
    private readonly events: EventBus
  ) { }

  async execute(input: DadosDoClienteInput & { nome: string, usuarioLogadoId: string }) {
    const dados = parseDadosDoCliente(input)

    if (dados.cpfCnpj && await this.clientes.findByCpfCnpj(dados.cpfCnpj.value)) {
      throw new CpfCnpjEmUsoError()
    }

    const cliente = Cliente.create({
      ...dados,
      nome: input.nome,
      // Por padrão o responsável é quem cadastrou
      usuarioId: dados.usuarioId ?? input.usuarioLogadoId,
    })
    await this.clientes.save(cliente)
    await this.events.publish(cliente.pullEvents())

    return toClienteDTO(cliente)
  }
}
