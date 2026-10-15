import type { Prisma, PrismaClient } from "../../../generated/prisma/client.ts";
import { ConcurrencyError } from "../../../shared/domain/ConcurrencyError.ts";
import { isForeignKeyViolation, isUniqueViolation } from "../../../shared/infrastructure/prismaErrors.ts";
import { Cliente } from "../domain/Cliente.ts";
import type { ClienteRepository } from "../domain/ClienteRepository.ts";
import { ClienteInvalidoError, CpfCnpjEmUsoError } from "../domain/errors.ts";

const include = { telefones: true, enderecos: true } as const

type ClienteRow = Prisma.ClienteGetPayload<{ include: typeof include }>

export class PostgresClienteRepository implements ClienteRepository {
  constructor(private readonly db: PrismaClient) {

  }

  async save(cliente: Cliente): Promise<void> {
    const data = {
      usuarioId: cliente.usuarioId,
      nome: cliente.nome,
      cpfCnpj: cliente.cpfCnpj,
      email: cliente.email,
      dataNascimento: cliente.dataNascimento,
      observacoes: cliente.observacoes,
      ativo: cliente.ativo,
    }
    const telefones = cliente.telefones.map(t => ({ ...t }))
    const enderecos = cliente.enderecos.map(e => ({ ...e }))

    try {
      if (cliente.version === 0) {
        await this.db.cliente.create({
          data: {
            ...data,
            id: cliente.id,
            criadoEm: cliente.createdAt,
            versao: 1,
            telefones: { create: telefones },
            enderecos: { create: enderecos },
          }
        })
        cliente.markPersisted(1)
        return
      }

      await this.db.$transaction(async (tx) => {
        const { count } = await tx.cliente.updateMany({
          where: { id: cliente.id, versao: cliente.version },
          data: { ...data, versao: { increment: 1 } }
        })

        if (count === 0) throw new ConcurrencyError('Cliente')

        // Telefones e endereços pertencem ao agregado: são substituídos por inteiro
        await tx.telefone.deleteMany({ where: { clienteId: cliente.id } })
        await tx.endereco.deleteMany({ where: { clienteId: cliente.id } })
        await tx.telefone.createMany({ data: telefones.map(t => ({ ...t, clienteId: cliente.id })) })
        await tx.endereco.createMany({ data: enderecos.map(e => ({ ...e, clienteId: cliente.id })) })
      })
      cliente.markPersisted(cliente.version + 1)
    } catch (err) {
      if (isUniqueViolation(err)) throw new CpfCnpjEmUsoError()
      if (isForeignKeyViolation(err)) throw new ClienteInvalidoError('Usuário responsável não encontrado')
      throw err
    }
  }

  async findById(id: string): Promise<Cliente | null> {
    const row = await this.db.cliente.findUnique({ where: { id }, include })

    return row ? toDomain(row) : null
  }

  async findByCpfCnpj(cpfCnpj: string): Promise<Cliente | null> {
    const row = await this.db.cliente.findUnique({ where: { cpfCnpj }, include })

    return row ? toDomain(row) : null
  }
}

function toDomain(row: ClienteRow): Cliente {
  return Cliente.restore({
    id: row.id,
    usuarioId: row.usuarioId,
    nome: row.nome,
    cpfCnpj: row.cpfCnpj,
    email: row.email,
    dataNascimento: row.dataNascimento,
    observacoes: row.observacoes,
    ativo: row.ativo,
    telefones: row.telefones.map(t => ({ tipo: t.tipo, numero: t.numero })),
    enderecos: row.enderecos.map(e => ({
      tipo: e.tipo,
      rua: e.rua,
      numero: e.numero,
      complemento: e.complemento,
      bairro: e.bairro,
      cep: e.cep,
      cidade: e.cidade,
      uf: e.uf,
    })),
    createdAt: row.criadoEm,
  }, row.versao)
}
