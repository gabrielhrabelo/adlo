import type { Documento as DocumentoRow, PrismaClient } from "../../../generated/prisma/client.ts";
import { isForeignKeyViolation, isRecordNotFound } from "../../../shared/infrastructure/prismaErrors.ts";
import { Documento } from "../domain/Documento.ts";
import type { DocumentoRepository } from "../domain/DocumentoRepository.ts";
import { DocumentoInvalidoError, DocumentoNotFoundError } from "../domain/errors.ts";

export class PostgresDocumentoRepository implements DocumentoRepository {
  constructor(private readonly db: PrismaClient) {

  }

  // Documentos são imutáveis: só existe inserção
  async save(documento: Documento): Promise<void> {
    if (documento.version !== 0) return

    try {
      await this.db.documento.create({
        data: {
          id: documento.id,
          clienteId: documento.clienteId,
          enviadoPorId: documento.enviadoPorId,
          nomeArquivo: documento.nomeArquivo,
          tipo: documento.tipo,
          chaveArmazenamento: documento.chaveArmazenamento,
          tamanhoBytes: documento.tamanhoBytes,
          sha256: documento.sha256,
          dataUpload: documento.dataUpload,
        }
      })
      documento.markPersisted(1)
    } catch (err) {
      if (isForeignKeyViolation(err)) throw new DocumentoInvalidoError('Cliente ou usuário não encontrado')
      throw err
    }
  }

  async findById(id: string): Promise<Documento | null> {
    const row = await this.db.documento.findUnique({ where: { id } })

    return row ? toDomain(row) : null
  }

  async delete(documento: Documento): Promise<void> {
    try {
      await this.db.documento.delete({ where: { id: documento.id } })
    } catch (err) {
      if (isRecordNotFound(err)) throw new DocumentoNotFoundError()
      throw err
    }
  }
}

function toDomain(row: DocumentoRow): Documento {
  return Documento.restore({
    id: row.id,
    clienteId: row.clienteId,
    enviadoPorId: row.enviadoPorId,
    nomeArquivo: row.nomeArquivo,
    tipo: row.tipo,
    chaveArmazenamento: row.chaveArmazenamento,
    tamanhoBytes: row.tamanhoBytes,
    sha256: row.sha256,
    dataUpload: row.dataUpload,
  })
}
