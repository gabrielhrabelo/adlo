import { createHash } from "node:crypto";
import type { EventBus } from "../../../shared/application/EventBus.ts";
import { Documento } from "../domain/Documento.ts";
import type { DocumentoRepository } from "../domain/DocumentoRepository.ts";
import { ClienteDoDocumentoInvalidoError } from "../domain/errors.ts";
import { detectarTipo } from "../domain/TipoDeArquivo.ts";
import { toDocumentoDTO } from "./dto.ts";
import type { ArmazenamentoDeArquivos, ReferenciasDoDocumento } from "./ports.ts";

// RF12 - Anexar documento a um cliente
export class AnexarDocumento {
  constructor(
    private readonly documentos: DocumentoRepository,
    private readonly armazenamento: ArmazenamentoDeArquivos,
    private readonly referencias: ReferenciasDoDocumento,
    private readonly events: EventBus
  ) { }

  async execute(input: {
    clienteId: string
    usuarioLogadoId: string
    nomeArquivo: string
    tipoDeclarado: string
    conteudo: Buffer
  }) {
    const situacao = await this.referencias.situacaoDoCliente(input.clienteId)

    if (situacao !== 'ativo') throw new ClienteDoDocumentoInvalidoError(situacao)

    const documento = Documento.anexar({
      clienteId: input.clienteId,
      enviadoPorId: input.usuarioLogadoId,
      nomeArquivo: input.nomeArquivo,
      tipo: detectarTipo(input.conteudo, input.tipoDeclarado),
      tamanhoBytes: input.conteudo.length,
      sha256: createHash('sha256').update(input.conteudo).digest('hex'),
    })

    await this.armazenamento.salvar(documento.chaveArmazenamento, input.conteudo)

    try {
      await this.documentos.save(documento)
    } catch (err) {
      // Sem o registro no banco o arquivo ficaria órfão
      await this.armazenamento.remover(documento.chaveArmazenamento).catch(() => { })
      throw err
    }
    await this.events.publish(documento.pullEvents())

    return toDocumentoDTO(documento)
  }
}
