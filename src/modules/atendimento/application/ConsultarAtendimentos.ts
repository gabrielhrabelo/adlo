import { AtendimentoInvalidoError, AtendimentoNotFoundError, ClienteDoAtendimentoNotFoundError } from "../domain/errors.ts";
import type { AtendimentoQueries, FiltrosDeAtendimento } from "./AtendimentoQueries.ts";
import type { ReferenciasDoAtendimento } from "./ports.ts";

export class ConsultarAtendimentos {
  constructor(
    private readonly queries: AtendimentoQueries,
    private readonly referencias: ReferenciasDoAtendimento
  ) { }

  async historico(filtros: FiltrosDeAtendimento) {
    if (!(await this.referencias.clienteExiste(filtros.clienteId))) {
      throw new ClienteDoAtendimentoNotFoundError()
    }
    if (filtros.de && filtros.ate && new Date(filtros.de) > new Date(filtros.ate)) {
      throw new AtendimentoInvalidoError('O início do período deve ser anterior ao fim')
    }
    return this.queries.historico(filtros)
  }

  async detalhar(id: string, clienteId?: string) {
    const atendimento = await this.queries.detalhar(id)

    if (!atendimento || (clienteId && atendimento.clienteId !== clienteId)) {
      throw new AtendimentoNotFoundError()
    }
    return atendimento
  }
}
