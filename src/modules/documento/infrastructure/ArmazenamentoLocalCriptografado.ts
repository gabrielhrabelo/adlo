import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import type { ArmazenamentoDeArquivos } from "../application/ports.ts";

const ALGORITMO = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16

// Guarda os arquivos em disco cifrados com AES-256-GCM (RNF03).
// Formato: IV (12 bytes) | tag de autenticação (16 bytes) | conteúdo cifrado
export class ArmazenamentoLocalCriptografado implements ArmazenamentoDeArquivos {
  private readonly raiz: string
  private readonly chave: Buffer

  constructor(diretorio: string, segredo: string) {
    if (segredo.length < 32) throw new Error('O segredo de criptografia dos documentos precisa ter pelo menos 32 caracteres')

    this.raiz = resolve(diretorio)
    this.chave = Buffer.from(hkdfSync('sha256', segredo, '', 'adlo-documentos', 32))
  }

  async salvar(chave: string, conteudo: Buffer): Promise<void> {
    const caminho = this.caminho(chave)
    const iv = randomBytes(IV_BYTES)
    const cipher = createCipheriv(ALGORITMO, this.chave, iv)
    const cifrado = Buffer.concat([cipher.update(conteudo), cipher.final()])

    await mkdir(dirname(caminho), { recursive: true })
    // Escreve em arquivo temporário e renomeia, para nunca deixar um arquivo pela metade
    const temporario = `${caminho}.${randomBytes(4).toString('hex')}.tmp`
    await writeFile(temporario, Buffer.concat([iv, cipher.getAuthTag(), cifrado]), { flag: 'wx' })
    await rename(temporario, caminho)
  }

  async ler(chave: string): Promise<Buffer> {
    const dados = await readFile(this.caminho(chave))
    const decipher = createDecipheriv(ALGORITMO, this.chave, dados.subarray(0, IV_BYTES))
    decipher.setAuthTag(dados.subarray(IV_BYTES, IV_BYTES + TAG_BYTES))

    return Buffer.concat([decipher.update(dados.subarray(IV_BYTES + TAG_BYTES)), decipher.final()])
  }

  async remover(chave: string): Promise<void> {
    await rm(this.caminho(chave), { force: true })
  }

  private caminho(chave: string): string {
    const caminho = resolve(this.raiz, chave)

    if (!caminho.startsWith(this.raiz + sep)) throw new Error(`Chave de armazenamento inválida: "${chave}"`)

    return caminho
  }
}
