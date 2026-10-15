import { randomUUID } from "node:crypto"
import { AggregateRoot } from "../../../shared/domain/AggregateRoot.ts"
import {
  BoardInvalidoError, CardNotFoundError, ColunaComCardsError, ColunaNotFoundError, ProcessoJaNoBoardError,
} from "./errors.ts"
import { BoardAlterado, BoardCriado, BoardExcluido, CardMovido } from "./events.ts"
import { COLUNAS_PADRAO, type StatusDoProcesso } from "./StatusDoProcesso.ts"

export const MAXIMO_DE_COLUNAS = 20

export interface Coluna {
  id: string
  nome: string
  ordem: number
  // Status aplicado ao processo quando um card é movido para esta coluna (RF17)
  status: StatusDoProcesso | null
}

export interface Card {
  id: string
  colunaId: string
  processoId: string
  titulo: string
  ordem: number
}

export interface BoardProps {
  id: string
  usuarioId: string
  nome: string
  colunas: Coluna[]
  cards: Card[]
  createdAt: Date
}

export interface DadosDaColuna {
  nome: string
  status?: StatusDoProcesso | null
}

// Quadro kanban de processos (RF16). Board, colunas e cards formam um único agregado (Figura 9)
export class Board extends AggregateRoot {
  private constructor(private readonly props: BoardProps) {
    super()
  }

  static criar(input: { usuarioId: string, nome: string, colunas?: DadosDaColuna[] }): Board {
    const board = new Board({
      id: randomUUID(),
      usuarioId: input.usuarioId,
      nome: Board.validarNome(input.nome),
      colunas: [],
      cards: [],
      createdAt: new Date(),
    })

    for (const coluna of input.colunas?.length ? input.colunas : COLUNAS_PADRAO) board.incluirColuna(coluna)

    board.pullEvents()
    board.addEvent(new BoardCriado(board.id))

    return board
  }

  static restore(props: BoardProps, version: number): Board {
    const board = new Board({
      ...props,
      colunas: [...props.colunas].sort((a, b) => a.ordem - b.ordem),
      cards: [...props.cards].sort((a, b) => a.ordem - b.ordem),
    })
    board.markPersisted(version)

    return board
  }

  renomear(nome: string): void {
    this.props.nome = Board.validarNome(nome)
    this.addEvent(new BoardAlterado(this.id))
  }

  excluir(): void {
    this.addEvent(new BoardExcluido(this.id))
  }

  // ---------------------------------------------------------------- colunas

  incluirColuna(input: DadosDaColuna & { posicao?: number }): Coluna {
    if (this.props.colunas.length >= MAXIMO_DE_COLUNAS) {
      throw new BoardInvalidoError(`O board pode ter no máximo ${MAXIMO_DE_COLUNAS} colunas`)
    }

    const coluna: Coluna = {
      id: randomUUID(),
      nome: Board.validarNomeDaColuna(input.nome),
      ordem: 0,
      status: this.validarStatusDaColuna(input.status ?? null),
    }

    inserir(this.props.colunas, coluna, input.posicao)
    this.addEvent(new BoardAlterado(this.id))

    return coluna
  }

  alterarColuna(colunaId: string, input: { nome?: string, status?: StatusDoProcesso | null, posicao?: number }): void {
    const coluna = this.coluna(colunaId)

    if (input.nome !== undefined) coluna.nome = Board.validarNomeDaColuna(input.nome)
    if (input.status !== undefined) coluna.status = this.validarStatusDaColuna(input.status, colunaId)
    if (input.posicao !== undefined) {
      remover(this.props.colunas, coluna)
      inserir(this.props.colunas, coluna, input.posicao)
    }

    this.addEvent(new BoardAlterado(this.id))
  }

  excluirColuna(colunaId: string): void {
    const coluna = this.coluna(colunaId)

    if (this.cardsDa(colunaId).length > 0) throw new ColunaComCardsError()

    remover(this.props.colunas, coluna)
    this.addEvent(new BoardAlterado(this.id))
  }

  // ---------------------------------------------------------------- cards

  incluirCard(input: { processoId: string, titulo: string, colunaId?: string, posicao?: number }): Card {
    if (this.props.cards.some(c => c.processoId === input.processoId)) throw new ProcessoJaNoBoardError()

    const colunaId = input.colunaId ?? this.props.colunas[0]?.id
    if (!colunaId) throw new BoardInvalidoError('Crie uma coluna antes de incluir cards')
    this.coluna(colunaId)

    const card: Card = {
      id: randomUUID(),
      colunaId,
      processoId: input.processoId,
      titulo: Board.validarTituloDoCard(input.titulo),
      ordem: 0,
    }

    this.props.cards.push(card)
    this.reposicionar(card, colunaId, input.posicao)
    this.addEvent(new BoardAlterado(this.id))

    return card
  }

  alterarCard(cardId: string, input: { titulo: string }): void {
    this.card(cardId).titulo = Board.validarTituloDoCard(input.titulo)
    this.addEvent(new BoardAlterado(this.id))
  }

  // RF17 - devolve o status que o processo deve assumir (null se a coluna não define status)
  moverCard(cardId: string, colunaId: string, posicao?: number): { processoId: string, status: StatusDoProcesso | null } {
    const card = this.card(cardId)
    const destino = this.coluna(colunaId)
    const origem = card.colunaId

    this.reposicionar(card, colunaId, posicao)

    if (origem !== colunaId) {
      this.addEvent(new CardMovido(this.id, card.id, card.processoId, origem, colunaId))
    }
    this.addEvent(new BoardAlterado(this.id))

    return { processoId: card.processoId, status: origem !== colunaId ? destino.status : null }
  }

  excluirCard(cardId: string): void {
    const card = this.card(cardId)
    const colunaId = card.colunaId

    this.props.cards = this.props.cards.filter(c => c.id !== cardId)
    renumerar(this.cardsDa(colunaId))
    this.addEvent(new BoardAlterado(this.id))
  }

  // Mantém o kanban coerente quando o status do processo muda fora do board.
  // Retorna true se algum card foi movido.
  sincronizarProcesso(processoId: string, status: StatusDoProcesso): boolean {
    const card = this.props.cards.find(c => c.processoId === processoId)
    const destino = this.props.colunas.find(c => c.status === status)

    if (!card || !destino || card.colunaId === destino.id) return false

    this.reposicionar(card, destino.id)
    this.addEvent(new BoardAlterado(this.id))

    return true
  }

  // ---------------------------------------------------------------- auxiliares

  private reposicionar(card: Card, colunaId: string, posicao?: number): void {
    const origem = this.cardsDa(card.colunaId).filter(c => c.id !== card.id)
    renumerar(origem)

    card.colunaId = colunaId
    const destino = this.cardsDa(colunaId).filter(c => c.id !== card.id)
    inserir(destino, card, posicao)
  }

  private cardsDa(colunaId: string): Card[] {
    return this.props.cards.filter(c => c.colunaId === colunaId).sort((a, b) => a.ordem - b.ordem)
  }

  private coluna(id: string): Coluna {
    const coluna = this.props.colunas.find(c => c.id === id)
    if (!coluna) throw new ColunaNotFoundError()
    return coluna
  }

  private card(id: string): Card {
    const card = this.props.cards.find(c => c.id === id)
    if (!card) throw new CardNotFoundError()
    return card
  }

  // Cada status só pode estar em uma coluna, senão a sincronização seria ambígua
  private validarStatusDaColuna(status: StatusDoProcesso | null, ignorarColunaId?: string): StatusDoProcesso | null {
    if (status && this.props.colunas.some(c => c.status === status && c.id !== ignorarColunaId)) {
      throw new BoardInvalidoError(`Já existe uma coluna vinculada ao status ${status}`)
    }
    return status
  }

  private static validarNome(raw: string): string {
    const nome = raw.trim()

    if (nome.length < 2 || nome.length > 80) throw new BoardInvalidoError('O nome do board precisa ter entre 2 e 80 caracteres')
    return nome
  }

  private static validarNomeDaColuna(raw: string): string {
    const nome = raw.trim()

    if (nome.length < 1 || nome.length > 60) throw new BoardInvalidoError('O nome da coluna precisa ter entre 1 e 60 caracteres')
    return nome
  }

  private static validarTituloDoCard(raw: string): string {
    const titulo = raw.trim()

    if (titulo.length < 1 || titulo.length > 200) throw new BoardInvalidoError('O título do card precisa ter entre 1 e 200 caracteres')
    return titulo
  }

  get id() { return this.props.id }
  get usuarioId() { return this.props.usuarioId }
  get nome() { return this.props.nome }
  get colunas(): readonly Readonly<Coluna>[] { return this.props.colunas }
  get cards(): readonly Readonly<Card>[] { return this.props.cards }
  get createdAt() { return this.props.createdAt }
}

// Insere na posição (0 = início; ausente ou além do fim = final) e renumera a ordem
function inserir<T extends { ordem: number }>(lista: T[], item: T, posicao?: number): void {
  const indice = posicao === undefined ? lista.length : Math.max(0, Math.min(Math.trunc(posicao), lista.length))
  lista.splice(indice, 0, item)
  renumerar(lista)
}

function remover<T extends { ordem: number }>(lista: T[], item: T): void {
  const indice = lista.indexOf(item)
  if (indice >= 0) lista.splice(indice, 1)
  renumerar(lista)
}

function renumerar(lista: { ordem: number }[]): void {
  lista.forEach((item, i) => { item.ordem = i })
}
