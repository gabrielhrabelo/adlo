import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { InMemoryEventBus } from "../../shared/infrastructure/InMemoryEventBus.ts";
import { AnexarDocumento } from "./application/AnexarDocumento.ts";
import { ConsultarDocumentos } from "./application/ConsultarDocumentos.ts";
import type { DocumentoQueries } from "./application/DocumentoQueries.ts";
import { ExcluirDocumento } from "./application/ExcluirDocumento.ts";
import type { ArmazenamentoDeArquivos, ReferenciasDoDocumento } from "./application/ports.ts";
import { Documento, TAMANHO_MAXIMO_BYTES } from "./domain/Documento.ts";
import type { DocumentoRepository } from "./domain/DocumentoRepository.ts";
import {
  ClienteDoDocumentoInvalidoError, DocumentoInvalidoError, DocumentoNotFoundError,
  RemocaoDeDocumentoNaoPermitidaError, TipoDeArquivoNaoPermitidoError,
} from "./domain/errors.ts";
import { detectarTipo } from "./domain/TipoDeArquivo.ts";
import { ArmazenamentoLocalCriptografado } from "./infrastructure/ArmazenamentoLocalCriptografado.ts";

const PDF = Buffer.from('%PDF-1.4\nconteudo de teste\n%%EOF')
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00])
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres'

class InMemoryDocumentoRepository implements DocumentoRepository {
  readonly rows = new Map<string, Documento>()
  falharAoSalvar = false

  async save(documento: Documento) {
    if (this.falharAoSalvar) throw new Error('banco fora do ar')
    this.rows.set(documento.id, documento)
    documento.markPersisted(1)
  }

  async findById(id: string) {
    return this.rows.get(id) ?? null
  }

  async delete(documento: Documento) {
    this.rows.delete(documento.id)
  }
}

class InMemoryArmazenamento implements ArmazenamentoDeArquivos {
  readonly arquivos = new Map<string, Buffer>()

  async salvar(chave: string, conteudo: Buffer) {
    this.arquivos.set(chave, conteudo)
  }

  async ler(chave: string) {
    const conteudo = this.arquivos.get(chave)
    if (!conteudo) throw new Error('arquivo não encontrado')
    return conteudo
  }

  async remover(chave: string) {
    this.arquivos.delete(chave)
  }
}

const referencias: ReferenciasDoDocumento = {
  situacaoDoCliente: async (id) => id === 'cli-1' || id === 'cli-2' ? 'ativo' : id === 'cli-inativo' ? 'inativo' : 'nao_encontrado',
  ehAdvogado: async (id) => id === 'advogado',
}

const queriesVazias: DocumentoQueries = {
  listar: async (filtros) => ({ items: [], total: 0, page: filtros.page ?? 1, pageSize: filtros.pageSize ?? 20 }),
  detalhar: async () => null,
}

describe('detectarTipo', () => {
  it('reconhece o tipo pela assinatura do conteúdo, não pelo tipo declarado', () => {
    assert.equal(detectarTipo(PDF, 'application/octet-stream'), 'application/pdf')
    assert.equal(detectarTipo(PNG, 'image/jpeg'), 'image/png')
    assert.equal(detectarTipo(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), ''), 'image/jpeg')
  })

  it('aceita DOCX/ODT (ZIP) apenas quando declarados como tal', () => {
    assert.equal(detectarTipo(ZIP, `${DOCX}; charset=binary`), DOCX)
    assert.throws(() => detectarTipo(ZIP, 'application/zip'), TipoDeArquivoNaoPermitidoError)
  })

  it('rejeita conteúdos desconhecidos, como executáveis disfarçados de PDF', () => {
    assert.throws(() => detectarTipo(Buffer.from('MZ\x90\x00'), 'application/pdf'), TipoDeArquivoNaoPermitidoError)
    assert.throws(() => detectarTipo(Buffer.alloc(0), 'application/pdf'), TipoDeArquivoNaoPermitidoError)
  })
})

describe('Documento', () => {
  const anexar = (input: Partial<Parameters<typeof Documento.anexar>[0]> = {}) => Documento.anexar({
    clienteId: 'cli-1', enviadoPorId: 'autor', nomeArquivo: 'laudo.pdf', tipo: 'application/pdf',
    tamanhoBytes: 100, sha256: 'abc', ...input,
  })

  it('gera chave de armazenamento por cliente e emite evento', () => {
    const documento = anexar()

    assert.equal(documento.chaveArmazenamento, `cli-1/${documento.id}`)
    assert.deepEqual(documento.pullEvents().map(e => e.name), ['documento.anexado'])
  })

  it('remove diretórios e caracteres de controle do nome do arquivo', () => {
    assert.equal(anexar({ nomeArquivo: '../../etc/passwd' }).nomeArquivo, 'passwd')
    assert.equal(anexar({ nomeArquivo: 'C:\\Users\\maria\\RG "frente".pdf' }).nomeArquivo, 'RG frente.pdf')
    assert.equal(anexar({ nomeArquivo: 'laudo\u0000\n.pdf' }).nomeArquivo, 'laudo.pdf')
    assert.throws(() => anexar({ nomeArquivo: '..' }), DocumentoInvalidoError)
    assert.throws(() => anexar({ nomeArquivo: 'pasta/' }), DocumentoInvalidoError)
  })

  it('rejeita arquivo vazio ou acima do limite', () => {
    assert.throws(() => anexar({ tamanhoBytes: 0 }), DocumentoInvalidoError)
    assert.throws(() => anexar({ tamanhoBytes: TAMANHO_MAXIMO_BYTES + 1 }), DocumentoInvalidoError)
  })

  it('só quem enviou ou um advogado podem remover', () => {
    const documento = anexar()

    assert.throws(() => documento.remover({ usuarioId: 'outro', ehAdvogado: false }), RemocaoDeDocumentoNaoPermitidaError)
    assert.doesNotThrow(() => documento.remover({ usuarioId: 'autor', ehAdvogado: false }))
    assert.doesNotThrow(() => documento.remover({ usuarioId: 'outro', ehAdvogado: true }))
  })
})

describe('casos de uso de documento', () => {
  let repo: InMemoryDocumentoRepository
  let armazenamento: InMemoryArmazenamento
  let events: InMemoryEventBus

  beforeEach(() => {
    repo = new InMemoryDocumentoRepository()
    armazenamento = new InMemoryArmazenamento()
    events = new InMemoryEventBus()
  })

  const anexar = (input: Partial<Parameters<AnexarDocumento['execute']>[0]> = {}) =>
    new AnexarDocumento(repo, armazenamento, referencias, events).execute({
      clienteId: 'cli-1', usuarioLogadoId: 'autor', nomeArquivo: 'laudo.pdf', tipoDeclarado: 'application/pdf',
      conteudo: PDF, ...input,
    })

  it('anexa guardando o conteúdo, o tamanho e o hash', async () => {
    const dto = await anexar()
    const documento = repo.rows.get(dto.id)!

    assert.equal(dto.tipo, 'application/pdf')
    assert.equal(dto.tamanhoBytes, PDF.length)
    assert.match(dto.sha256, /^[0-9a-f]{64}$/)
    assert.deepEqual(armazenamento.arquivos.get(documento.chaveArmazenamento), PDF)
  })

  it('só anexa para cliente ativo e existente', async () => {
    await assert.rejects(anexar({ clienteId: 'cli-inativo' }), ClienteDoDocumentoInvalidoError)
    await assert.rejects(anexar({ clienteId: 'x' }), ClienteDoDocumentoInvalidoError)
    assert.equal(armazenamento.arquivos.size, 0)
  })

  it('não deixa arquivo órfão quando o registro no banco falha', async () => {
    repo.falharAoSalvar = true

    await assert.rejects(anexar(), /banco fora do ar/)
    assert.equal(armazenamento.arquivos.size, 0)
  })

  it('exclui o registro e o arquivo respeitando autor/advogado e o cliente da rota', async () => {
    const excluir = new ExcluirDocumento(repo, armazenamento, referencias, events)
    const { id } = await anexar()

    await assert.rejects(excluir.execute({ id, usuarioLogadoId: 'outro' }), RemocaoDeDocumentoNaoPermitidaError)
    await assert.rejects(excluir.execute({ id, clienteId: 'cli-2', usuarioLogadoId: 'advogado' }), DocumentoNotFoundError)
    await excluir.execute({ id, clienteId: 'cli-1', usuarioLogadoId: 'advogado' })

    assert.equal(repo.rows.size, 0)
    assert.equal(armazenamento.arquivos.size, 0)
  })

  it('baixa o conteúdo apenas pelo cliente correto e lista só de cliente existente', async () => {
    const consultar = new ConsultarDocumentos(queriesVazias, repo, armazenamento, referencias)
    const { id } = await anexar({ nomeArquivo: 'rg.pdf' })

    const arquivo = await consultar.baixar(id, 'cli-1')
    assert.equal(arquivo.nomeArquivo, 'rg.pdf')
    assert.deepEqual(arquivo.conteudo, PDF)

    await assert.rejects(consultar.baixar(id, 'cli-2'), DocumentoNotFoundError)
    await assert.rejects(consultar.listar({ clienteId: 'x' }), ClienteDoDocumentoInvalidoError)
    assert.equal((await consultar.listar({ clienteId: 'cli-inativo' })).total, 0)
  })
})

describe('ArmazenamentoLocalCriptografado', () => {
  let diretorio: string

  before(async () => { diretorio = await mkdtemp(join(tmpdir(), 'adlo-documentos-')) })
  after(async () => { await rm(diretorio, { recursive: true, force: true }) })

  it('grava cifrado e lê o conteúdo original', async () => {
    const armazenamento = new ArmazenamentoLocalCriptografado(diretorio, SEGREDO)

    await armazenamento.salvar('cli-1/doc-1', PDF)
    const emDisco = await readFile(join(diretorio, 'cli-1', 'doc-1'))

    assert.equal(emDisco.includes(Buffer.from('conteudo de teste')), false)
    assert.deepEqual(await armazenamento.ler('cli-1/doc-1'), PDF)
  })

  it('não consegue ler com outro segredo nem com o arquivo adulterado', async () => {
    const armazenamento = new ArmazenamentoLocalCriptografado(diretorio, SEGREDO)
    await armazenamento.salvar('cli-1/doc-2', PDF)

    const outroSegredo = new ArmazenamentoLocalCriptografado(diretorio, `${SEGREDO}-outro`)
    await assert.rejects(outroSegredo.ler('cli-1/doc-2'))

    // O GCM autentica o conteúdo: qualquer byte alterado invalida a leitura
    const caminho = join(diretorio, 'cli-1', 'doc-2')
    const adulterado = await readFile(caminho)
    const ultimo = adulterado.length - 1
    adulterado[ultimo] = adulterado[ultimo]! ^ 0xff
    await writeFile(caminho, adulterado)
    await assert.rejects(armazenamento.ler('cli-1/doc-2'))
  })

  it('remove sem falhar quando o arquivo já não existe', async () => {
    const armazenamento = new ArmazenamentoLocalCriptografado(diretorio, SEGREDO)

    await armazenamento.salvar('cli-1/doc-3', PDF)
    await armazenamento.remover('cli-1/doc-3')
    await armazenamento.remover('cli-1/doc-3')
    await assert.rejects(armazenamento.ler('cli-1/doc-3'))
  })

  it('rejeita chaves fora do diretório e segredos curtos', async () => {
    const armazenamento = new ArmazenamentoLocalCriptografado(diretorio, SEGREDO)

    await assert.rejects(armazenamento.salvar('../fora', PDF), /Chave de armazenamento inválida/)
    assert.throws(() => new ArmazenamentoLocalCriptografado(diretorio, 'curto'))
  })
})
