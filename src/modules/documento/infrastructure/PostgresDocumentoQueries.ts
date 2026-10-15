import type { Prisma, PrismaClient } from "../../../generated/prisma/client.ts";
import { normalizePage, type Page } from "../../../shared/application/Pagination.ts";
import type { DocumentoDetalheDTO, DocumentoQueries, FiltrosDeDocumento } from "../application/DocumentoQueries.ts";

const include = { enviadoPor: { select: { id: true, nome: true } } } as const

type Row = Prisma.DocumentoGetPayload<{ include: typeof include }>

export class PostgresDocumentoQueries implements DocumentoQueries {
  constructor(private readonly db: PrismaClient) {

  }

  async listar(filtros: FiltrosDeDocumento): Promise<Page<DocumentoDetalheDTO>> {
    const { page, pageSize, skip } = normalizePage(filtros)
    const busca = filtros.busca?.trim()
    const where: Prisma.DocumentoWhereInput = {
      clienteId: filtros.clienteId,
      ...(filtros.tipo && { tipo: filtros.tipo }),
      ...(busca && { nomeArquivo: { contains: busca, mode: 'insensitive' } }),
    }

    const [total, rows] = await Promise.all([
      this.db.documento.count({ where }),
      this.db.documento.findMany({ where, skip, take: pageSize, orderBy: { dataUpload: 'desc' }, include }),
    ])

    return { total, page, pageSize, items: rows.map(toDTO) }
  }

  async detalhar(id: string): Promise<DocumentoDetalheDTO | null> {
    const row = await this.db.documento.findUnique({ where: { id }, include })

    return row ? toDTO(row) : null
  }
}

function toDTO(row: Row): DocumentoDetalheDTO {
  return {
    id: row.id,
    clienteId: row.clienteId,
    enviadoPorId: row.enviadoPorId,
    nomeArquivo: row.nomeArquivo,
    tipo: row.tipo,
    tamanhoBytes: row.tamanhoBytes,
    sha256: row.sha256,
    dataUpload: row.dataUpload.toISOString(),
    enviadoPor: row.enviadoPor,
  }
}
