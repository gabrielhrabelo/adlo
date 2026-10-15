import { AgendamentoInvalidoError, ReferenciaNaoEncontradaError } from "../domain/errors.ts";
import type { Referencias } from "./ports.ts";

export async function validarUsuario(referencias: Referencias, usuarioId: string): Promise<void> {
  const usuario = await referencias.usuario(usuarioId)

  if (!usuario) throw new ReferenciaNaoEncontradaError('Usuário')
  if (!usuario.ativo) throw new AgendamentoInvalidoError('O usuário responsável está inativo')
}

export async function validarProcesso(referencias: Referencias, processoId: string, clienteId: string): Promise<void> {
  const processo = await referencias.processo(processoId)

  if (!processo) throw new ReferenciaNaoEncontradaError('Processo')
  if (processo.clienteId !== clienteId) {
    throw new AgendamentoInvalidoError('O processo informado pertence a outro cliente')
  }
}
