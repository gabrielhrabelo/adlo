import { DomainError } from "../../../shared/domain/DomainError.ts";

export class DocumentoNotFoundError extends DomainError {
  constructor() {
    super('Documento não encontrado', 'DOCUMENTO_NOT_FOUND', 'not_found')
  }
}

export class DocumentoInvalidoError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_DOCUMENTO', 'validation')
  }
}

export class TipoDeArquivoNaoPermitidoError extends DomainError {
  constructor() {
    super(
      'Tipo de arquivo não permitido. Envie PDF, imagem (JPEG, PNG, WebP) ou documento de texto (DOC, DOCX, ODT)',
      'TIPO_DE_ARQUIVO_NAO_PERMITIDO',
      'validation'
    )
  }
}

export class ClienteDoDocumentoInvalidoError extends DomainError {
  constructor(motivo: 'nao_encontrado' | 'inativo') {
    super(
      motivo === 'inativo' ? 'O cliente está inativo' : 'Cliente não encontrado',
      motivo === 'inativo' ? 'CLIENTE_INATIVO' : 'CLIENTE_NOT_FOUND',
      motivo === 'inativo' ? 'conflict' : 'not_found'
    )
  }
}

export class RemocaoDeDocumentoNaoPermitidaError extends DomainError {
  constructor() {
    super('Somente quem enviou ou um advogado pode excluir este documento', 'FORBIDDEN', 'forbidden')
  }
}
