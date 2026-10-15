import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { InMemoryEventBus } from "../../shared/infrastructure/InMemoryEventBus.ts";
import { AlterarAgendamento } from "./application/AlterarAgendamento.ts";
import { AlterarStatusDoAgendamento } from "./application/AlterarStatusDoAgendamento.ts";
import { EnviarAlertas, type Logger } from "./application/EnviarAlertas.ts";
import { IncluirAgendamento } from "./application/IncluirAgendamento.ts";
import type { AlertaDeAgendamento, AlertaStore, Clock, Notificador, Referencias } from "./application/ports.ts";
import { VerificadorDeHorario } from "./application/VerificadorDeHorario.ts";
import { Agendamento, STATUS_ATIVOS } from "./domain/Agendamento.ts";
import type { AgendamentoRepository } from "./domain/AgendamentoRepository.ts";
import {
  AgendamentoEncerradoError, AgendamentoInvalidoError, HorarioOcupadoError,
  ReferenciaNaoEncontradaError, TransicaoDeStatusInvalidaError,
} from "./domain/errors.ts";
import { corpo } from "./infrastructure/notificadores.ts";

const AGORA = new Date('2026-10-15T12:00:00.000Z')
const clock: Clock = () => AGORA
const HORA = 60 * 60 * 1000

const em = (horas: number) => new Date(AGORA.getTime() + horas * HORA)

class InMemoryAgendamentoRepository implements AgendamentoRepository {
  readonly rows = new Map<string, Agendamento>()

  async save(agendamento: Agendamento) {
    this.rows.set(agendamento.id, agendamento)
    agendamento.markPersisted(agendamento.version + 1)
  }

  async delete(agendamento: Agendamento) {
    this.rows.delete(agendamento.id)
  }

  async findById(id: string) {
    return this.rows.get(id) ?? null
  }

  async findAtivosDoUsuarioEntre(usuarioId: string, de: Date, ate: Date) {
    return [...this.rows.values()].filter(a =>
      a.usuarioId === usuarioId && STATUS_ATIVOS.includes(a.status) && a.inicio >= de.getTime() && a.inicio < ate.getTime())
  }
}

const referencias: Referencias = {
  cliente: async (id) => ({ 'cli-1': { ativo: true }, 'cli-2': { ativo: true }, 'cli-inativo': { ativo: false } } as Record<string, { ativo: boolean }>)[id] ?? null,
  processo: async (id) => id === 'proc-1' ? { clienteId: 'cli-1' } : null,
  usuario: async (id) => ({ u1: { ativo: true }, u2: { ativo: true }, inativo: { ativo: false } } as Record<string, { ativo: boolean }>)[id] ?? null,
}

const novo = (input: Partial<Parameters<typeof Agendamento.create>[0]> = {}) => Agendamento.create({
  clienteId: 'cli-1', usuarioId: 'u1', titulo: 'Audiência de instrução', dataHora: em(48), tipo: 'AUDIENCIA', ...input,
}, AGORA)

describe('Agendamento', () => {
  it('cria PENDENTE com lembrete pela antecedência padrão do tipo', () => {
    const agendamento = novo()

    assert.equal(agendamento.status, 'PENDENTE')
    assert.equal(agendamento.antecedenciaMinutos, 24 * 60)
    assert.equal(agendamento.lembrarEm?.toISOString(), em(24).toISOString())
    assert.deepEqual(agendamento.pullEvents().map(e => e.name), ['agendamento.incluido'])
  })

  it('rejeita data no passado, título curto e duração inválida', () => {
    assert.throws(() => novo({ dataHora: em(-1) }), AgendamentoInvalidoError)
    assert.throws(() => novo({ titulo: 'a' }), AgendamentoInvalidoError)
    assert.throws(() => novo({ duracaoMinutos: 0 }), AgendamentoInvalidoError)
  })

  it('detecta sobreposição só entre agendamentos ativos do mesmo usuário que ocupam a agenda', () => {
    const a = novo({ dataHora: em(2), duracaoMinutos: 60 })
    const sobreposto = novo({ dataHora: em(2.5) })
    const depois = novo({ dataHora: em(3) })
    const outroUsuario = novo({ dataHora: em(2.5), usuarioId: 'u2' })
    const prazo = novo({ dataHora: em(2.5), tipo: 'PRAZO' })

    assert.equal(a.conflitaCom(sobreposto), true)
    assert.equal(a.conflitaCom(depois), false)
    assert.equal(a.conflitaCom(outroUsuario), false)
    assert.equal(a.conflitaCom(prazo), false)

    sobreposto.cancelar()
    assert.equal(a.conflitaCom(sobreposto), false)
  })

  it('controla as transições de status e bloqueia alterações após encerrar', () => {
    const agendamento = novo()

    agendamento.confirmar()
    assert.throws(() => agendamento.confirmar(), TransicaoDeStatusInvalidaError)

    agendamento.concluir(AGORA)
    assert.equal(agendamento.concluidoEm, AGORA)
    assert.throws(() => agendamento.cancelar(), TransicaoDeStatusInvalidaError)
    assert.throws(() => agendamento.alterar({ titulo: 'Outro título' }, AGORA), AgendamentoEncerradoError)
  })

  it('remarcar recalcula o lembrete e libera um novo alerta', () => {
    const agendamento = Agendamento.restore({
      id: 'a1', clienteId: 'cli-1', usuarioId: 'u1', processoId: null, titulo: 'Reunião', tipo: 'COMPROMISSO',
      status: 'PENDENTE', dataHora: em(3), duracaoMinutos: 60, lembrarEm: em(1), notificadoEm: em(1),
      concluidoEm: null, createdAt: AGORA,
    }, 1)

    agendamento.alterar({ dataHora: em(10) }, AGORA)

    assert.equal(agendamento.lembrarEm?.toISOString(), em(8).toISOString())
    assert.equal(agendamento.notificadoEm, null)
  })
})

describe('casos de uso de agendamento', () => {
  let repo: InMemoryAgendamentoRepository
  let events: InMemoryEventBus
  let verificador: VerificadorDeHorario

  beforeEach(() => {
    repo = new InMemoryAgendamentoRepository()
    events = new InMemoryEventBus()
    verificador = new VerificadorDeHorario(repo)
  })

  const incluir = (input: Partial<Parameters<IncluirAgendamento['execute']>[0]> = {}) =>
    new IncluirAgendamento(repo, verificador, referencias, events, clock).execute({
      clienteId: 'cli-1', titulo: 'Reunião com cliente', dataHora: em(5).toISOString(), usuarioLogadoId: 'u1', ...input,
    })

  it('inclui com o usuário logado como responsável por padrão', async () => {
    const dto = await incluir({ processoId: 'proc-1', antecedenciaMinutos: 30 })

    assert.equal(dto.usuarioId, 'u1')
    assert.equal(dto.antecedenciaMinutos, 30)
    assert.equal(repo.rows.size, 1)
  })

  it('valida cliente, responsável e processo', async () => {
    await assert.rejects(incluir({ clienteId: 'x' }), ReferenciaNaoEncontradaError)
    await assert.rejects(incluir({ clienteId: 'cli-inativo' }), AgendamentoInvalidoError)
    await assert.rejects(incluir({ usuarioId: 'inativo' }), AgendamentoInvalidoError)
    await assert.rejects(incluir({ processoId: 'proc-x' }), ReferenciaNaoEncontradaError)
    await assert.rejects(incluir({ clienteId: 'cli-2', processoId: 'proc-1' }), AgendamentoInvalidoError)
  })

  it('verifica se o horário está ocupado ao incluir e ao alterar', async () => {
    const primeiro = await incluir()
    const segundo = await incluir({ dataHora: em(7).toISOString() })

    await assert.rejects(incluir({ dataHora: em(5.5).toISOString() }), HorarioOcupadoError)
    // Prazos não ocupam a agenda e outro responsável está livre
    await incluir({ dataHora: em(5.5).toISOString(), tipo: 'PRAZO' })
    await incluir({ dataHora: em(5.5).toISOString(), usuarioId: 'u2' })

    const alterar = new AlterarAgendamento(repo, verificador, referencias, events, clock)
    await assert.rejects(alterar.execute({ id: segundo.id, dataHora: primeiro.dataHora }), HorarioOcupadoError)

    assert.equal((await verificador.disponibilidade({ usuarioId: 'u1', dataHora: em(5), duracaoMinutos: 30 })).livre, false)
    assert.equal((await verificador.disponibilidade({ usuarioId: 'u1', dataHora: em(10), duracaoMinutos: 30 })).livre, true)
  })

  it('cancelar libera o horário', async () => {
    const { id } = await incluir()

    await new AlterarStatusDoAgendamento(repo, events, clock).execute({ id, acao: 'cancelar' })
    await incluir()

    assert.equal(repo.rows.size, 2)
  })
})

describe('EnviarAlertas', () => {
  const alerta = (id: string): AlertaDeAgendamento => ({
    agendamentoId: id,
    titulo: 'Audiência',
    tipo: 'AUDIENCIA',
    dataHora: em(24),
    duracaoMinutos: 60,
    cliente: { id: 'cli-1', nome: 'Maria' },
    processo: { id: 'proc-1', titulo: 'Auxílio-doença', numeroProcesso: '0000001-06.2026.4.01.0001' },
    destinatario: { id: 'u1', nome: 'Ana', email: 'ana@x.com' },
  })

  const logger: Logger = { info: () => { }, error: () => { } }

  class FakeStore implements AlertaStore {
    readonly reservados = new Set<string>()
    readonly liberados: string[] = []

    constructor(private readonly itens: AlertaDeAgendamento[], private readonly jaReservados: string[] = []) { }

    async pendentes() { return this.itens }

    async reservar(id: string) {
      if (this.jaReservados.includes(id) || this.reservados.has(id)) return false
      this.reservados.add(id)
      return true
    }

    async liberar(id: string) {
      this.reservados.delete(id)
      this.liberados.push(id)
    }
  }

  it('envia os pendentes, pula os já reservados e libera os que falharam', async () => {
    const store = new FakeStore([alerta('a'), alerta('b'), alerta('c')], ['b'])
    const enviados: string[] = []
    const notificador: Notificador = {
      notificar: async (a) => {
        if (a.agendamentoId === 'c') throw new Error('SMTP fora do ar')
        enviados.push(a.agendamentoId)
      },
    }

    const resultado = await new EnviarAlertas(store, notificador, clock, logger).execute()

    assert.deepEqual(resultado, { enviados: 1, falhas: 1 })
    assert.deepEqual(enviados, ['a'])
    assert.deepEqual(store.liberados, ['c'])
  })

  it('monta o corpo do e-mail com cliente e processo', () => {
    const texto = corpo(alerta('a'))

    assert.match(texto, /Cliente: Maria/)
    assert.match(texto, /Processo: 0000001-06\.2026\.4\.01\.0001 - Auxílio-doença/)
  })
})
