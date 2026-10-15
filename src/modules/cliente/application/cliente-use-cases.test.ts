import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { InMemoryEventBus } from "../../../shared/infrastructure/InMemoryEventBus.ts";
import type { Cliente } from "../domain/Cliente.ts";
import type { ClienteRepository } from "../domain/ClienteRepository.ts";
import { ClienteNotFoundError, CpfCnpjEmUsoError } from "../domain/errors.ts";
import { AlterarSituacaoDoCliente } from "./AlterarSituacaoDoCliente.ts";
import { AtualizarCliente } from "./AtualizarCliente.ts";
import { CadastrarCliente } from "./CadastrarCliente.ts";

class InMemoryClienteRepository implements ClienteRepository {
  readonly rows = new Map<string, Cliente>()

  async save(cliente: Cliente) {
    this.rows.set(cliente.id, cliente)
    cliente.markPersisted(cliente.version + 1)
  }

  async findById(id: string) {
    return this.rows.get(id) ?? null
  }

  async findByCpfCnpj(cpfCnpj: string) {
    return [...this.rows.values()].find(c => c.cpfCnpj === cpfCnpj) ?? null
  }
}

describe('casos de uso de cliente', () => {
  let clientes: InMemoryClienteRepository
  let events: InMemoryEventBus

  beforeEach(() => {
    clientes = new InMemoryClienteRepository()
    events = new InMemoryEventBus()
  })

  const cadastrar = (cpfCnpj = '529.982.247-25') => new CadastrarCliente(clientes, events).execute({
    nome: 'Maria',
    cpfCnpj,
    usuarioLogadoId: 'u1',
    telefones: [{ numero: '62999991234' }],
  })

  it('cadastra com o usuário logado como responsável por padrão', async () => {
    const out = await cadastrar()

    assert.equal(out.usuarioId, 'u1')
    assert.equal(out.cpfCnpj, '52998224725')
    assert.equal(out.telefones.length, 1)
  })

  it('bloqueia CPF/CNPJ duplicado no cadastro e na edição', async () => {
    const maria = await cadastrar()
    const joao = await cadastrar('11.222.333/0001-81')

    await assert.rejects(cadastrar(), CpfCnpjEmUsoError)
    await assert.rejects(new AtualizarCliente(clientes, events).execute({ id: joao.id, cpfCnpj: maria.cpfCnpj }), CpfCnpjEmUsoError)
  })

  it('atualiza e substitui telefones', async () => {
    const { id } = await cadastrar()
    const out = await new AtualizarCliente(clientes, events).execute({ id, telefones: [], nome: 'Maria José' })

    assert.equal(out.nome, 'Maria José')
    assert.deepEqual(out.telefones, [])
  })

  it('inativa e reativa; falha para cliente inexistente', async () => {
    const { id } = await cadastrar()
    const situacao = new AlterarSituacaoDoCliente(clientes, events)

    assert.equal((await situacao.execute({ id, ativo: false })).ativo, false)
    assert.equal((await situacao.execute({ id, ativo: true })).ativo, true)
    await assert.rejects(situacao.execute({ id: 'x', ativo: false }), ClienteNotFoundError)
  })
})
