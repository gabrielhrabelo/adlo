import type { Cliente } from "./Cliente.ts";

export interface ClienteRepository {
  save(cliente: Cliente): Promise<void>
  findById(id: string): Promise<Cliente | null>
  findByCpfCnpj(cpfCnpj: string): Promise<Cliente | null>
}
