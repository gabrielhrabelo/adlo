import { randomUUID } from "node:crypto"
import { AggregateRoot } from "../../../shared/domain/AggregateRoot.ts"
import { DocumentoInvalidoError, RemocaoDeDocumentoNaoPermitidaError } from "./errors.ts"
import { DocumentoAnexado, DocumentoRemovido } from "./events.ts"
import type { TipoDeArquivo } from "./TipoDeArquivo.ts"

export const TAMANHO_MAXIMO_BYTES = 20 * 1024 * 1024

export interface DocumentoProps {
  id: string
  clienteId: string
  enviadoPorId: string | null
  nomeArquivo: string
  tipo: string
  chaveArmazenamento: string
  tamanhoBytes: number
  sha256: string
  dataUpload: Date
}

// Documento anexado a um cliente (RF12). Imutável: anexar, visualizar, baixar e remover (Figura 9)
export class Documento extends AggregateRoot {
  private constructor(private readonly props: DocumentoProps) {
    super()
  }

  static anexar(input: {
    clienteId: string
    enviadoPorId: string
    nomeArquivo: string
    tipo: TipoDeArquivo
    tamanhoBytes: number
    sha256: string
  }): Documento {
    if (input.tamanhoBytes <= 0) throw new DocumentoInvalidoError('O arquivo está vazio')
    if (input.tamanhoBytes > TAMANHO_MAXIMO_BYTES) {
      throw new DocumentoInvalidoError(`O arquivo passa do limite de ${TAMANHO_MAXIMO_BYTES / 1024 / 1024} MB`)
    }

    const id = randomUUID()
    const documento = new Documento({
      id,
      clienteId: input.clienteId,
      enviadoPorId: input.enviadoPorId,
      nomeArquivo: Documento.sanitizarNome(input.nomeArquivo),
      tipo: input.tipo,
      chaveArmazenamento: `${input.clienteId}/${id}`,
      tamanhoBytes: input.tamanhoBytes,
      sha256: input.sha256,
      dataUpload: new Date(),
    })

    documento.addEvent(new DocumentoAnexado(documento.id, documento.clienteId))

    return documento
  }

  static restore(props: DocumentoProps): Documento {
    const documento = new Documento({ ...props })
    documento.markPersisted(1)

    return documento
  }

  // Regra: somente quem enviou ou um advogado podem remover
  remover(por: { usuarioId: string, ehAdvogado: boolean }): void {
    if (!por.ehAdvogado && por.usuarioId !== this.props.enviadoPorId) {
      throw new RemocaoDeDocumentoNaoPermitidaError()
    }
    this.addEvent(new DocumentoRemovido(this.id, this.clienteId))
  }

  // Remove diretórios e caracteres de controle; o nome é usado no download
  private static sanitizarNome(raw: string): string {
    const nome = (raw.split(/[\\/]/).pop() ?? '')
      .replace(/[\u0000-\u001f\u007f"]/g, '')
      .trim()
      .slice(-255)

    if (!nome || nome === '.' || nome === '..') throw new DocumentoInvalidoError('Nome de arquivo inválido')

    return nome
  }

  get id() { return this.props.id }
  get clienteId() { return this.props.clienteId }
  get enviadoPorId() { return this.props.enviadoPorId }
  get nomeArquivo() { return this.props.nomeArquivo }
  get tipo() { return this.props.tipo }
  get chaveArmazenamento() { return this.props.chaveArmazenamento }
  get tamanhoBytes() { return this.props.tamanhoBytes }
  get sha256() { return this.props.sha256 }
  get dataUpload() { return this.props.dataUpload }
}
