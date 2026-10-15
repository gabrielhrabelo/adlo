import { TipoDeArquivoNaoPermitidoError } from "./errors.ts"

const PDF = 'application/pdf'
const JPEG = 'image/jpeg'
const PNG = 'image/png'
const WEBP = 'image/webp'
const DOC = 'application/msword'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const ODT = 'application/vnd.oasis.opendocument.text'

export const TIPOS_PERMITIDOS = [PDF, JPEG, PNG, WEBP, DOC, DOCX, ODT] as const
export type TipoDeArquivo = typeof TIPOS_PERMITIDOS[number]

// DOCX e ODT são pacotes ZIP: a assinatura não distingue um do outro
const BASEADOS_EM_ZIP: readonly string[] = [DOCX, ODT]

const comeca = (conteudo: Uint8Array, assinatura: number[], offset = 0) =>
  assinatura.every((byte, i) => conteudo[offset + i] === byte)

// Confere a assinatura (magic number) do conteúdo em vez de confiar só no
// Content-Type informado pelo navegador
export function detectarTipo(conteudo: Uint8Array, declarado: string): TipoDeArquivo {
  const tipoDeclarado = declarado.split(';')[0]!.trim().toLowerCase()

  if (comeca(conteudo, [0x25, 0x50, 0x44, 0x46, 0x2d])) return PDF
  if (comeca(conteudo, [0xff, 0xd8, 0xff])) return JPEG
  if (comeca(conteudo, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return PNG
  if (comeca(conteudo, [0x52, 0x49, 0x46, 0x46]) && comeca(conteudo, [0x57, 0x45, 0x42, 0x50], 8)) return WEBP
  if (comeca(conteudo, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return DOC
  if (comeca(conteudo, [0x50, 0x4b, 0x03, 0x04]) && BASEADOS_EM_ZIP.includes(tipoDeclarado)) {
    return tipoDeclarado as TipoDeArquivo
  }

  throw new TipoDeArquivoNaoPermitidoError()
}
