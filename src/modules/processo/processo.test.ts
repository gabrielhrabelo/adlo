import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { InMemoryEventBus } from "../../shared/infrastructure/InMemoryEventBus.ts";
import { AlterarStatusDoProcesso } from "./application/AlterarStatusDoProcesso.ts";
import { AtualizarProcesso } from "./application/AtualizarProcesso.ts";
import { CadastrarProcesso } from "./application/CadastrarProcesso.ts";
import { ExcluirProcesso } from "./application/ExcluirProcesso.ts";
import type { ClienteLookup } from "./application/ports.ts";
import {
  ClienteDoProcessoInvalidoError, NumeroProcessoEmUsoError, NumeroProcessoInvalidoError,
  ProcessoComVinculosError, ProcessoInvalidoError, ProcessoNotFoundError,
} from "./domain/errors.ts";
import { NumeroProcesso } from "./domain/NumeroProcesso.ts";
import { Processo } from "./domain/Processo.ts";
import type { ProcessoRepository } from "./domain/ProcessoRepository.ts";

const NUMERO_1 = '0000001-06.2026.4.01.0001'
const NUMERO_2 = '5001234-73.2025.8.09.0051'

class InMemoryProcessoRepository implements ProcessoRepository {
  readonly rows = new Map<string, Processo>()
  readonly comVinculos = new Set<string>()

  async save(processo: Processo) {
    this.rows.set(processo.id, processo)
    processo.markPersisted(processo.version + 1)
  }

  async findById(id: string) {
    return this.rows.get(id) ?? null
  }

  async findByNumero(numeroProcesso: string) {
    return [...this.rows.values()].find(p => p.numeroProcesso === numeroProcesso) ?? null
  }

  async possuiVinculos(id: string) {
    return this.comVinculos.has(id)
  }

  async delete(id: string) {
    this.rows.delete(id)
  }
}

const clientes: ClienteLookup = {
  situacao: async (id) => id === 'cli-ativo' ? 'ativo' : id === 'cli-inativo' ? 'inativo' : 'nao_encontrado',
}

describe('NumeroProcesso', () => {
  it('aceita número CNJ válido com ou sem máscara', () => {
    assert.equal(NumeroProcesso.create(NUMERO_1).value, NUMERO_1)
    assert.equal(NumeroProcesso.create(NUMERO_2.replace(/\D/g, '')).value, NUMERO_2)
  })

  it('rejeita dígito verificador errado e tamanho inválido', () => {
    assert.throws(() => NumeroProcesso.create('0000001-07.2026.4.01.0001'), NumeroProcessoInvalidoError)
    assert.throws(() => NumeroProcesso.create('123'), NumeroProcessoInvalidoError)
  })
})

describe('Processo', () => {
  const novo = () => Processo.create({ clienteId: 'c', titulo: ' Auxílio-doença ', area: 'INSS' })

  it('cria em TRIAGEM, normaliza título e emite evento', () => {
    const processo = novo()

    assert.equal(processo.titulo, 'Auxílio-doença')
    assert.equal(processo.status, 'TRIAGEM')
    assert.deepEqual(processo.pullEvents().map(e => e.name), ['processo.cadastrado'])
  })

  it('rejeita título curto e abertura no futuro', () => {
    assert.throws(() => Processo.create({ clienteId: 'c', titulo: 'ab', area: 'INSS' }), ProcessoInvalidoError)
    assert.throws(() => novo().atualizar({ dataAbertura: new Date(Date.now() + 86_400_000) }), ProcessoInvalidoError)
  })

  it('só emite evento de status quando o status muda; arquivar vai para ARQUIVADO', () => {
    const processo = novo()
    processo.pullEvents()

    processo.alterarStatus('TRIAGEM')
    processo.alterarStatus('PROTOCOLO')
    processo.arquivar()

    assert.equal(processo.status, 'ARQUIVADO')
    assert.deepEqual(processo.pullEvents().map(e => e.name), ['processo.status-alterado', 'processo.status-alterado'])
  })
})

describe('casos de uso de processo', () => {
  let processos: InMemoryProcessoRepository
  let events: InMemoryEventBus

  beforeEach(() => {
    processos = new InMemoryProcessoRepository()
    events = new InMemoryEventBus()
  })

  const cadastrar = (input: Partial<Parameters<CadastrarProcesso['execute']>[0]> = {}) =>
    new CadastrarProcesso(processos, clientes, events).execute({
      clienteId: 'cli-ativo', titulo: 'Pensão por morte', area: 'INSS', ...input,
    })

  it('cadastra apenas para cliente ativo e existente', async () => {
    const dto = await cadastrar({ numeroProcesso: NUMERO_1.replace(/\D/g, '') })

    assert.equal(dto.numeroProcesso, NUMERO_1)
    await assert.rejects(cadastrar({ clienteId: 'cli-inativo' }), ClienteDoProcessoInvalidoError)
    await assert.rejects(cadastrar({ clienteId: 'x' }), ClienteDoProcessoInvalidoError)
  })

  it('bloqueia número de processo duplicado no cadastro e na edição', async () => {
    await cadastrar({ numeroProcesso: NUMERO_1 })
    const outro = await cadastrar({ numeroProcesso: NUMERO_2 })

    await assert.rejects(cadastrar({ numeroProcesso: NUMERO_1 }), NumeroProcessoEmUsoError)
    await assert.rejects(
      new AtualizarProcesso(processos, events).execute({ id: outro.id, numeroProcesso: NUMERO_1 }),
      NumeroProcessoEmUsoError,
    )
  })

  it('altera status e falha para processo inexistente', async () => {
    const { id } = await cadastrar()
    const alterar = new AlterarStatusDoProcesso(processos, events)

    assert.equal((await alterar.execute({ id, status: 'EM_ANDAMENTO' })).status, 'EM_ANDAMENTO')
    await assert.rejects(alterar.execute({ id: 'x', status: 'CONCLUIDO' }), ProcessoNotFoundError)
  })

  it('exclui somente processos sem agendamentos ou atendimentos', async () => {
    const excluir = new ExcluirProcesso(processos, events)
    const comHistorico = await cadastrar()
    const semHistorico = await cadastrar()
    processos.comVinculos.add(comHistorico.id)

    await assert.rejects(excluir.execute(comHistorico.id), ProcessoComVinculosError)
    await excluir.execute(semHistorico.id)

    assert.equal(processos.rows.has(semHistorico.id), false)
    assert.equal(processos.rows.has(comHistorico.id), true)
  })
})
