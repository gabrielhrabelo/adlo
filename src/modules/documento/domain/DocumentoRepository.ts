import type { Documento } from "./Documento.ts";

export interface DocumentoRepository {
  save(documento: Documento): Promise<void>
  findById(id: string): Promise<Documento | null>
  delete(documento: Documento): Promise<void>
}
