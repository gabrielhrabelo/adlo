import type { Documento } from "../domain/Documento.ts";

export interface DocumentoDTO {
  id: string
  clienteId: string
  enviadoPorId: string | null
  nomeArquivo: string
  tipo: string
  tamanhoBytes: number
  sha256: string
  dataUpload: string
}

export function toDocumentoDTO(documento: Documento): DocumentoDTO {
  return {
    id: documento.id,
    clienteId: documento.clienteId,
    enviadoPorId: documento.enviadoPorId,
    nomeArquivo: documento.nomeArquivo,
    tipo: documento.tipo,
    tamanhoBytes: documento.tamanhoBytes,
    sha256: documento.sha256,
    dataUpload: documento.dataUpload.toISOString(),
  }
}
