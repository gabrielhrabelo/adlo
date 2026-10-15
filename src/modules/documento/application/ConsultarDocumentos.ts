import type { DocumentoRepository } from "../domain/DocumentoRepository.ts";
import { ClienteDoDocumentoInvalidoError, DocumentoNotFoundError } from "../domain/errors.ts";
import type { DocumentoQueries, FiltrosDeDocumento } from "./DocumentoQueries.ts";
import type { ArmazenamentoDeArquivos, ReferenciasDoDocumento } from "./ports.ts";

// Consultar, visualizar e baixar documentos do cliente (Figura 4 / Figura 9)
export class ConsultarDocumentos {
  constructor(
    private readonly queries: DocumentoQueries,
    private readonly documentos: DocumentoRepository,
    private readonly armazenamento: ArmazenamentoDeArquivos,
    private readonly referencias: ReferenciasDoDocumento
  ) { }

  async listar(filtros: FiltrosDeDocumento) {
    if ((await this.referencias.situacaoDoCliente(filtros.clienteId)) === 'nao_encontrado') {
      throw new ClienteDoDocumentoInvalidoError('nao_encontrado')
    }
    return this.queries.listar(filtros)
  }

  async detalhar(id: string, clienteId?: string) {
    const documento = await this.queries.detalhar(id)

    if (!documento || (clienteId && documento.clienteId !== clienteId)) throw new DocumentoNotFoundError()

    return documento
  }

  async baixar(id: string, clienteId?: string) {
    const documento = await this.documentos.findById(id)

    if (!documento || (clienteId && documento.clienteId !== clienteId)) throw new DocumentoNotFoundError()

    return {
      nomeArquivo: documento.nomeArquivo,
      tipo: documento.tipo,
      conteudo: await this.armazenamento.ler(documento.chaveArmazenamento),
    }
  }
}
