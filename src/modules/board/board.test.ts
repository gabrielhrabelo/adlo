import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { InMemoryEventBus } from "../../shared/infrastructure/InMemoryEventBus.ts";
import { ManterBoard } from "./application/ManterBoard.ts";
import { ManterCards } from "./application/ManterCards.ts";
import { ManterColunas } from "./application/ManterColunas.ts";
import type { ProcessosDoBoard } from "./application/ports.ts";
import { SincronizarCardsDoProcesso } from "./application/SincronizarCardsDoProcesso.ts";
import { Board, MAXIMO_DE_COLUNAS } from "./domain/Board.ts";
import type { BoardRepository } from "./domain/BoardRepository.ts";
import {
  BoardInvalidoError, BoardNotFoundError, CardNotFoundError, ColunaComCardsError, ColunaNotFoundError,
  ProcessoDoCardNotFoundError, ProcessoJaNoBoardError,
} from "./domain/errors.ts";
import type { StatusDoProcesso } from "./domain/StatusDoProcesso.ts";

class InMemoryBoardRepository implements BoardRepository {
  readonly rows = new Map<string, Board>()

  async save(board: Board) {
    this.rows.set(board.id, board)
    board.markPersisted(board.version + 1)
  }

  async findById(id: string) {
    return this.rows.get(id) ?? null
  }

  async findByProcesso(processoId: string) {
    return [...this.rows.values()].filter(b => b.cards.some(c => c.processoId === processoId))
  }

  async delete(board: Board) {
    this.rows.delete(board.id)
  }
}

class FakeProcessos implements ProcessosDoBoard {
  readonly status = new Map<string, StatusDoProcesso>([['proc-1', 'TRIAGEM'], ['proc-2', 'PROTOCOLO'], ['proc-3', 'TRIAGEM']])
  readonly alteracoes: { processoId: string, status: StatusDoProcesso }[] = []

  async resumo(processoId: string) {
    const status = this.status.get(processoId)
    if (!status) return null
    return {
      titulo: `Processo ${processoId}`,
      numeroProcesso: processoId === 'proc-1' ? '0000001-06.2026.4.01.0001' : null,
      status,
    }
  }

  async alterarStatus(processoId: string, status: StatusDoProcesso) {
    this.status.set(processoId, status)
    this.alteracoes.push({ processoId, status })
  }
}

const colunaDo = (board: Board, status: StatusDoProcesso) => board.colunas.find(c => c.status === status)!.id
const processosNaColuna = (board: Board, colunaId: string) =>
  board.cards.filter(c => c.colunaId === colunaId).sort((a, b) => a.ordem - b.ordem).map(c => c.processoId)

describe('Board', () => {
  const novo = () => Board.criar({ usuarioId: 'u1', nome: ' Processos INSS ' })

  it('cria com uma coluna por etapa do processo e emite um único evento', () => {
    const board = novo()

    assert.equal(board.nome, 'Processos INSS')
    assert.deepEqual(board.colunas.map(c => c.status), ['TRIAGEM', 'DOCUMENTACAO', 'PROTOCOLO', 'EM_ANDAMENTO', 'AGUARDANDO', 'CONCLUIDO'])
    assert.deepEqual(board.colunas.map(c => c.ordem), [0, 1, 2, 3, 4, 5])
    assert.deepEqual(board.pullEvents().map(e => e.name), ['board.criado'])
  })

  it('aceita colunas personalizadas e rejeita status repetido', () => {
    const board = Board.criar({ usuarioId: 'u1', nome: 'Kanban', colunas: [{ nome: 'A fazer' }, { nome: 'Feito', status: 'CONCLUIDO' }] })

    assert.deepEqual(board.colunas.map(c => c.nome), ['A fazer', 'Feito'])
    assert.throws(() => board.incluirColuna({ nome: 'Outra', status: 'CONCLUIDO' }), BoardInvalidoError)
    assert.throws(() => board.alterarColuna(board.colunas[0]!.id, { status: 'CONCLUIDO' }), BoardInvalidoError)
    // A própria coluna pode manter o seu status
    assert.doesNotThrow(() => board.alterarColuna(board.colunas[1]!.id, { status: 'CONCLUIDO', nome: 'Concluídos' }))
  })

  it('valida nomes e o limite de colunas', () => {
    assert.throws(() => Board.criar({ usuarioId: 'u1', nome: 'x' }), BoardInvalidoError)

    const board = Board.criar({ usuarioId: 'u1', nome: 'Kanban', colunas: [{ nome: 'Única' }] })
    assert.throws(() => board.incluirColuna({ nome: '   ' }), BoardInvalidoError)

    for (let i = board.colunas.length; i < MAXIMO_DE_COLUNAS; i++) board.incluirColuna({ nome: `Coluna ${i}` })
    assert.throws(() => board.incluirColuna({ nome: 'Excedente' }), BoardInvalidoError)
  })

  it('insere e reposiciona colunas renumerando a ordem', () => {
    const board = Board.criar({ usuarioId: 'u1', nome: 'Kanban', colunas: [{ nome: 'A' }, { nome: 'B' }, { nome: 'C' }] })

    const inicio = board.incluirColuna({ nome: 'Início', posicao: 0 })
    assert.deepEqual(board.colunas.map(c => c.nome), ['Início', 'A', 'B', 'C'])

    board.alterarColuna(inicio.id, { posicao: 99 })
    assert.deepEqual(board.colunas.map(c => c.nome), ['A', 'B', 'C', 'Início'])
    assert.deepEqual(board.colunas.map(c => c.ordem), [0, 1, 2, 3])
  })

  it('só exclui colunas sem cards', () => {
    const board = novo()
    const triagem = colunaDo(board, 'TRIAGEM')

    board.incluirCard({ processoId: 'proc-1', titulo: 'Card' })

    assert.throws(() => board.excluirColuna(triagem), ColunaComCardsError)
    board.excluirColuna(colunaDo(board, 'AGUARDANDO'))
    assert.equal(board.colunas.length, 5)
    assert.throws(() => board.excluirColuna('nao-existe'), ColunaNotFoundError)
  })

  it('inclui cards na primeira coluna por padrão e não repete o processo', () => {
    const board = novo()
    const card = board.incluirCard({ processoId: 'proc-1', titulo: ' Auxílio-doença ' })

    assert.equal(card.colunaId, colunaDo(board, 'TRIAGEM'))
    assert.equal(card.titulo, 'Auxílio-doença')
    assert.throws(() => board.incluirCard({ processoId: 'proc-1', titulo: 'De novo' }), ProcessoJaNoBoardError)
    assert.throws(() => board.incluirCard({ processoId: 'proc-2', titulo: 'X', colunaId: 'nao-existe' }), ColunaNotFoundError)
  })

  it('move cards entre colunas, respeitando a posição, e informa o novo status', () => {
    const board = novo()
    const triagem = colunaDo(board, 'TRIAGEM')
    const protocolo = colunaDo(board, 'PROTOCOLO')
    const a = board.incluirCard({ processoId: 'a', titulo: 'A' })
    board.incluirCard({ processoId: 'b', titulo: 'B' })
    board.incluirCard({ processoId: 'c', titulo: 'C', colunaId: protocolo })
    board.pullEvents()

    assert.deepEqual(board.moverCard(a.id, protocolo, 0), { processoId: 'a', status: 'PROTOCOLO' })
    assert.deepEqual(processosNaColuna(board, protocolo), ['a', 'c'])
    assert.deepEqual(processosNaColuna(board, triagem), ['b'])
    assert.deepEqual(board.cards.find(c => c.processoId === 'b')?.ordem, 0)
    assert.ok(board.pullEvents().some(e => e.name === 'board.card-movido'))

    // Reordenar dentro da mesma coluna não altera o status do processo
    assert.deepEqual(board.moverCard(a.id, protocolo, 1), { processoId: 'a', status: null })
    assert.deepEqual(processosNaColuna(board, protocolo), ['c', 'a'])
  })

  it('mover para coluna sem status vinculado não altera o processo', () => {
    const board = Board.criar({ usuarioId: 'u1', nome: 'Kanban', colunas: [{ nome: 'Entrada' }, { nome: 'Revisar' }] })
    const card = board.incluirCard({ processoId: 'a', titulo: 'A' })

    assert.deepEqual(board.moverCard(card.id, board.colunas[1]!.id), { processoId: 'a', status: null })
    assert.throws(() => board.moverCard('nao-existe', board.colunas[0]!.id), CardNotFoundError)
  })

  it('exclui card renumerando a coluna', () => {
    const board = novo()
    const triagem = colunaDo(board, 'TRIAGEM')
    const a = board.incluirCard({ processoId: 'a', titulo: 'A' })
    board.incluirCard({ processoId: 'b', titulo: 'B' })

    board.excluirCard(a.id)

    assert.deepEqual(processosNaColuna(board, triagem), ['b'])
    assert.equal(board.cards[0]?.ordem, 0)
  })

  it('sincroniza o card com o status alterado fora do kanban', () => {
    const board = novo()
    board.incluirCard({ processoId: 'a', titulo: 'A' })

    assert.equal(board.sincronizarProcesso('a', 'EM_ANDAMENTO'), true)
    assert.deepEqual(processosNaColuna(board, colunaDo(board, 'EM_ANDAMENTO')), ['a'])
    // Já está na coluna, status sem coluna (ARQUIVADO) ou processo fora do board: nada muda
    assert.equal(board.sincronizarProcesso('a', 'EM_ANDAMENTO'), false)
    assert.equal(board.sincronizarProcesso('a', 'ARQUIVADO'), false)
    assert.equal(board.sincronizarProcesso('outro', 'TRIAGEM'), false)
  })
})

describe('casos de uso do board', () => {
  let boards: InMemoryBoardRepository
  let processos: FakeProcessos
  let events: InMemoryEventBus

  beforeEach(() => {
    boards = new InMemoryBoardRepository()
    processos = new FakeProcessos()
    events = new InMemoryEventBus()
  })

  const criarBoard = () => new ManterBoard(boards, events).criar({ usuarioLogadoId: 'u1', nome: 'Processos' })

  it('cria, renomeia e exclui o board; falha para board inexistente', async () => {
    const manter = new ManterBoard(boards, events)
    const { id } = await criarBoard()

    assert.equal((await manter.renomear({ id, nome: 'Processos DPVAT' })).nome, 'Processos DPVAT')
    await manter.excluir(id)
    assert.equal(boards.rows.size, 0)
    await assert.rejects(manter.renomear({ id, nome: 'Outro' }), BoardNotFoundError)
  })

  it('gerencia colunas pelo caso de uso', async () => {
    const colunas = new ManterColunas(boards, events)
    const { id } = await criarBoard()

    const comArquivados = await colunas.incluir({ boardId: id, nome: 'Arquivados', status: 'ARQUIVADO' })
    const arquivados = comArquivados.colunas.find(c => c.status === 'ARQUIVADO')!

    assert.equal(arquivados.ordem, comArquivados.colunas.length - 1)
    const renomeado = await colunas.alterar({ boardId: id, colunaId: arquivados.id, nome: 'Arquivo morto', posicao: 0 })
    assert.equal(renomeado.colunas[0]?.nome, 'Arquivo morto')

    const semColuna = await colunas.excluir({ boardId: id, colunaId: arquivados.id })
    assert.equal(semColuna.colunas.some(c => c.id === arquivados.id), false)
  })

  it('inclui card na coluna do status atual do processo e com título padrão', async () => {
    const cards = new ManterCards(boards, processos, events)
    const { id } = await criarBoard()

    const dto = await cards.incluir({ boardId: id, processoId: 'proc-2' })
    const protocolo = dto.colunas.find(c => c.status === 'PROTOCOLO')!
    assert.equal(protocolo.cards[0]?.titulo, 'Processo proc-2')

    const comNumero = await cards.incluir({ boardId: id, processoId: 'proc-1' })
    const triagem = comNumero.colunas.find(c => c.status === 'TRIAGEM')!
    assert.equal(triagem.cards[0]?.titulo, '0000001-06.2026.4.01.0001 - Processo proc-1')

    await assert.rejects(cards.incluir({ boardId: id, processoId: 'nao-existe' }), ProcessoDoCardNotFoundError)
    await assert.rejects(cards.incluir({ boardId: 'nao-existe', processoId: 'proc-3' }), BoardNotFoundError)
  })

  it('mover o card atualiza o status do processo (RF17)', async () => {
    const cards = new ManterCards(boards, processos, events)
    const { id } = await criarBoard()
    const dto = await cards.incluir({ boardId: id, processoId: 'proc-1' })
    const cardId = dto.colunas.flatMap(c => c.cards)[0]!.id
    const emAndamento = dto.colunas.find(c => c.status === 'EM_ANDAMENTO')!.id

    const movido = await cards.mover({ boardId: id, cardId, colunaId: emAndamento })

    assert.deepEqual(processos.alteracoes, [{ processoId: 'proc-1', status: 'EM_ANDAMENTO' }])
    assert.equal(movido.colunas.find(c => c.id === emAndamento)?.cards.length, 1)

    // Reordenar na mesma coluna não chama o módulo de processos
    await cards.mover({ boardId: id, cardId, colunaId: emAndamento, posicao: 0 })
    assert.equal(processos.alteracoes.length, 1)
  })

  it('altera e exclui card', async () => {
    const cards = new ManterCards(boards, processos, events)
    const { id } = await criarBoard()
    const dto = await cards.incluir({ boardId: id, processoId: 'proc-1' })
    const cardId = dto.colunas.flatMap(c => c.cards)[0]!.id

    const alterado = await cards.alterar({ boardId: id, cardId, titulo: 'Maria - auxílio' })
    assert.equal(alterado.colunas.flatMap(c => c.cards)[0]?.titulo, 'Maria - auxílio')

    const semCard = await cards.excluir({ boardId: id, cardId })
    assert.equal(semCard.colunas.flatMap(c => c.cards).length, 0)
  })

  it('sincroniza os cards de todos os boards do processo quando o status muda', async () => {
    const cards = new ManterCards(boards, processos, events)
    const primeiro = await criarBoard()
    const segundo = await criarBoard()
    await cards.incluir({ boardId: primeiro.id, processoId: 'proc-1' })
    await cards.incluir({ boardId: segundo.id, processoId: 'proc-1' })

    await new SincronizarCardsDoProcesso(boards, events).execute({ processoId: 'proc-1', status: 'CONCLUIDO' })

    for (const board of boards.rows.values()) {
      assert.deepEqual(processosNaColuna(board, colunaDo(board, 'CONCLUIDO')), ['proc-1'])
    }
  })
})
