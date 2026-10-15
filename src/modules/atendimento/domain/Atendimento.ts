import { randomUUID } from "node:crypto"
import { AggregateRoot } from "../../../shared/domain/AggregateRoot.ts"
import { AtendimentoInvalidoError, ExclusaoDeAtendimentoNaoPermitidaError } from "./errors.ts"
import { AtendimentoExcluido, AtendimentoRegistrado } from "./events.ts"

export const CANAIS = ['PRESENCIAL', 'TELEFONE', 'WHATSAPP', 'EMAIL'] as const
export type CanalDeAtendimento = typeof CANAIS[number]

export interface AtendimentoProps {
  id: string
  clienteId: string
  usuarioId: string | null
  processoId: string | null
  assunto: string
  conteudo: string
  canal: CanalDeAtendimento
  ocorridoEm: Date
  createdAt: Date
}

// Registro do histórico do cliente (RF10). Atendimentos são imutáveis: incluir, consultar e excluir (Figura 4)
export class Atendimento extends AggregateRoot {
  private constructor(private readonly props: AtendimentoProps) {
    super()
  }

  static registrar(input: {
    clienteId: string
    usuarioId: string
    processoId?: string | null
    assunto: string
    conteudo: string
    canal?: CanalDeAtendimento
    ocorridoEm?: Date
  }): Atendimento {
    const assunto = input.assunto.trim()
    const conteudo = input.conteudo.trim()
    const agora = new Date()

    if (assunto.length < 2 || assunto.length > 200) {
      throw new AtendimentoInvalidoError('O assunto precisa ter entre 2 e 200 caracteres')
    }
    if (!conteudo || conteudo.length > 20000) {
      throw new AtendimentoInvalidoError('O conteúdo precisa ter entre 1 e 20000 caracteres')
    }
    if (input.ocorridoEm && input.ocorridoEm.getTime() > agora.getTime() + 60_000) {
      throw new AtendimentoInvalidoError('A data do atendimento não pode estar no futuro')
    }

    const atendimento = new Atendimento({
      id: randomUUID(),
      clienteId: input.clienteId,
      usuarioId: input.usuarioId,
      processoId: input.processoId ?? null,
      assunto,
      conteudo,
      canal: input.canal ?? 'PRESENCIAL',
      ocorridoEm: input.ocorridoEm ?? agora,
      createdAt: agora,
    })

    atendimento.addEvent(new AtendimentoRegistrado(atendimento.id, atendimento.clienteId))

    return atendimento
  }

  static restore(props: AtendimentoProps): Atendimento {
    const atendimento = new Atendimento({ ...props })
    atendimento.markPersisted(1)

    return atendimento
  }

  // Regra: somente o autor ou um advogado podem excluir
  excluir(por: { usuarioId: string, ehAdvogado: boolean }): void {
    if (!por.ehAdvogado && por.usuarioId !== this.props.usuarioId) {
      throw new ExclusaoDeAtendimentoNaoPermitidaError()
    }
    this.addEvent(new AtendimentoExcluido(this.id, this.clienteId))
  }

  get id() { return this.props.id }
  get clienteId() { return this.props.clienteId }
  get usuarioId() { return this.props.usuarioId }
  get processoId() { return this.props.processoId }
  get assunto() { return this.props.assunto }
  get conteudo() { return this.props.conteudo }
  get canal() { return this.props.canal }
  get ocorridoEm() { return this.props.ocorridoEm }
  get createdAt() { return this.props.createdAt }
}
