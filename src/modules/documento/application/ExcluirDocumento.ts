import type { EventBus } from "../../../shared/application/EventBus.ts";
import type { DocumentoRepository } from "../domain/DocumentoRepository.ts";
import { DocumentoNotFoundError } from "../domain/errors.ts";
import type { ArmazenamentoDeArquivos, ReferenciasDoDocumento } from "./ports.ts";

// RF13 - Excluir documento: somente quem enviou ou um advogado
export class ExcluirDocumento {
  constructor(
    private readonly documentos: DocumentoRepository,
    private readonly armazenamento: ArmazenamentoDeArquivos,
    private readonly referencias: ReferenciasDoDocumento,
    private readonly events: EventBus
  ) { }

  async execute(input: { id: string, clienteId?: string, usuarioLogadoId: string }): Promise<void> {
    const documento = await this.documentos.findById(input.id)

    if (!documento || (input.clienteId && documento.clienteId !== input.clienteId)) {
      throw new DocumentoNotFoundError()
    }

    documento.remover({
      usuarioId: input.usuarioLogadoId,
      ehAdvogado: await this.referencias.ehAdvogado(input.usuarioLogadoId),
    })
    await this.documentos.delete(documento)
    await this.armazenamento.remover(documento.chaveArmazenamento)
    await this.events.publish(documento.pullEvents())
  }
}
