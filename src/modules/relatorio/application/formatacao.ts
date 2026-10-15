export const FUSO_DO_ESCRITORIO = 'America/Sao_Paulo'

// Brasília não tem horário de verão desde 2019: UTC-3 fixo
const OFFSET_HORAS = 3

export const ROTULOS_STATUS_PROCESSO: Record<string, string> = {
  TRIAGEM: 'Triagem',
  DOCUMENTACAO: 'Documentação',
  PROTOCOLO: 'Protocolo',
  EM_ANDAMENTO: 'Em andamento',
  AGUARDANDO: 'Aguardando',
  CONCLUIDO: 'Concluído',
  ARQUIVADO: 'Arquivado',
}

export const ROTULOS_STATUS_AGENDAMENTO: Record<string, string> = {
  PENDENTE: 'Pendente',
  CONFIRMADO: 'Confirmado',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
}

export function formatarCpfCnpj(value: string | null): string {
  if (!value) return '-'
  if (value.length === 11) return value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (value.length === 14) return value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return value
}

export function formatarTelefone(value: string | null): string {
  if (!value) return '-'
  if (value.length === 11) return value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (value.length === 10) return value.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return value
}

// Colunas @db.Date chegam como meia-noite UTC
export function formatarData(date: Date | null): string {
  if (!date) return '-'
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

export function formatarDataHora(date: Date): string {
  return date.toLocaleString('pt-BR', {
    timeZone: FUSO_DO_ESCRITORIO,
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// "2026-10-15" no fuso do escritório -> instante UTC do início do dia
export function inicioDoDia(isoDate: string): Date {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!, OFFSET_HORAS))
}

export function fimDoDia(isoDate: string): Date {
  return new Date(inicioDoDia(isoDate).getTime() + 24 * 60 * 60 * 1000 - 1)
}

// Data local (YYYY-MM-DD) no fuso do escritório
export function hojeNoEscritorio(agora: Date): string {
  return agora.toLocaleDateString('en-CA', { timeZone: FUSO_DO_ESCRITORIO })
}

export function inicioDoMes(agora: Date): Date {
  return inicioDoDia(`${hojeNoEscritorio(agora).slice(0, 7)}-01`)
}

export function somarDias(isoDate: string, dias: number): string {
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + dias)
  return date.toISOString().slice(0, 10)
}

export function formatarDataIso(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
