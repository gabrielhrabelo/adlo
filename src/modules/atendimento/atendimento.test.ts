import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { InMemoryEventBus } from "../../shared/infrastructure/InMemoryEventBus.ts";
import type { ReferenciasDoAtendimento } from "./application/ports.ts";
import { ExcluirAtendimento } from "./application/ExcluirAtendimento.ts";
import { RegistrarAtendimento } from "./application/RegistrarAtendimento.ts";
import { Atendimento } from "./domain/Atendimento.ts";
import type { AtendimentoRepository } from "./domain/AtendimentoRepository.ts";
import {
  AtendimentoInvalidoError, AtendimentoNotFoundError, ClienteDoAtendimentoNotFoundError,
  ExclusaoDeAtendimentoNaoPermitidaError, ProcessoDeOutroClienteError,
} from "./domain/errors.ts";

class InMemoryAtendimentoRepository implements AtendimentoRepository {
  readonly rows = new Map<string, Atendimento>()

  async save(atendimento: Atendimento) {
    this.rows.set(atendimento.id, atendimento)
    atendimento.markPersisted(1)
  }

  async findById(id: string) {
    return this.rows.get(id) ?? null
  }

  async delete(atendimento: Atendimento) {
    this.rows.delete(atendimento.id)
  }
}

const referencias: ReferenciasDoAtendimento = {
  clienteExiste: async (id) => id === 'cli-1' || id === 'cli-2',
  clienteDoProcesso: async (id) => ({ 'proc-1': 'cli-1', 'proc-2': 'cli-2' } as Record<string, string>)[id] ?? null,
  ehAdvogado: async (id) => id === 'advogado',
}

describe('Atendimento', () => {
  it('normaliza texto, usa PRESENCIAL por padrão e emite evento', () => {
    const a = Atendimento.registrar({ clienteId: 'cli-1', usuarioId: 'u', assunto: '  Triagem ', conteudo: ' Cliente trouxe laudo ' })

    assert.equal(a.assunto, 'Triagem')
    assert.equal(a.conteudo, 'Cliente trouxe laudo')
    assert.equal(a.canal, 'PRESENCIAL')
    assert.deepEqual(a.pullEvents().map(e => e.name), ['atendimento.registrado'])
  })

  it('rejeita assunto curto, conteúdo vazio e data futura', () => {
    const base = { clienteId: 'c', usuarioId: 'u', assunto: 'Ok assunto', conteudo: 'x' }

    assert.throws(() => Atendimento.registrar({ ...base, assunto: 'a' }), AtendimentoInvalidoError)
    assert.throws(() => Atendimento.registrar({ ...base, conteudo: '   ' }), AtendimentoInvalidoError)
    assert.throws(() => Atendimento.registrar({ ...base, ocorridoEm: new Date(Date.now() + 86_400_000) }), AtendimentoInvalidoError)
  })

  it('só autor ou advogado podem excluir', () => {
    const a = Atendimento.registrar({ clienteId: 'c', usuarioId: 'autor', assunto: 'Assunto', conteudo: 'x' })

    assert.throws(() => a.excluir({ usuarioId: 'outro', ehAdvogado: false }), ExclusaoDeAtendimentoNaoPermitidaError)
    assert.doesNotThrow(() => a.excluir({ usuarioId: 'autor', ehAdvogado: false }))
    assert.doesNotThrow(() => a.excluir({ usuarioId: 'outro', ehAdvogado: true }))
  })
})

describe('casos de uso de atendimento', () => {
  let repo: InMemoryAtendimentoRepository
  let events: InMemoryEventBus

  beforeEach(() => {
    repo = new InMemoryAtendimentoRepository()
    events = new InMemoryEventBus()
  })

  const registrar = (input: Partial<Parameters<RegistrarAtendimento['execute']>[0]> = {}) =>
    new RegistrarAtendimento(repo, referencias, events).execute({
      clienteId: 'cli-1', usuarioLogadoId: 'estagiario', assunto: 'Ligação', conteudo: 'Pediu atualização', ...input,
    })

  it('registra atendimento com usuário logado como autor', async () => {
    const dto = await registrar({ canal: 'WHATSAPP', processoId: 'proc-1', ocorridoEm: '2026-01-10T13:00:00Z' })

    assert.equal(dto.usuarioId, 'estagiario')
    assert.equal(dto.canal, 'WHATSAPP')
    assert.equal(dto.ocorridoEm, '2026-01-10T13:00:00.000Z')
    assert.equal(repo.rows.size, 1)
  })

  it('falha para cliente inexistente ou processo de outro cliente', async () => {
    await assert.rejects(registrar({ clienteId: 'nao-existe' }), ClienteDoAtendimentoNotFoundError)
    await assert.rejects(registrar({ processoId: 'proc-2' }), ProcessoDeOutroClienteError)
    await assert.rejects(registrar({ processoId: 'proc-x' }), ProcessoDeOutroClienteError)
  })

  it('exclui respeitando autor/advogado e o cliente da rota', async () => {
    const excluir = new ExcluirAtendimento(repo, referencias, events)
    const { id } = await registrar()

    await assert.rejects(excluir.execute({ id, usuarioLogadoId: 'outro' }), ExclusaoDeAtendimentoNaoPermitidaError)
    await assert.rejects(excluir.execute({ id, clienteId: 'cli-2', usuarioLogadoId: 'advogado' }), AtendimentoNotFoundError)
    await excluir.execute({ id, clienteId: 'cli-1', usuarioLogadoId: 'advogado' })
    assert.equal(repo.rows.size, 0)
  })
})
