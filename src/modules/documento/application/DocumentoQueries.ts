import type { Page, PageRequest } from "../../../shared/application/Pagination.ts";
import type { DocumentoDTO } from "./dto.ts";

export interface FiltrosDeDocumento extends PageRequest {
  clienteId: string
  // Busca pelo nome do arquivo
  busca?: string
  tipo?: string
}

export interface DocumentoDetalheDTO extends DocumentoDTO {
  enviadoPor: { id: string, nome: string } | null
}

// "Consultar documentos do cliente" (Figura 4)
export interface DocumentoQueries {
  listar(filtros: FiltrosDeDocumento): Promise<Page<DocumentoDetalheDTO>>
  detalhar(id: string): Promise<DocumentoDetalheDTO | null>
}
