export const AREAS = ['INSS', 'DPVAT'] as const
export type AreaDoProcesso = typeof AREAS[number]

export const STATUS_DO_PROCESSO = [
  'TRIAGEM',
  'DOCUMENTACAO',
  'PROTOCOLO',
  'EM_ANDAMENTO',
  'AGUARDANDO',
  'CONCLUIDO',
  'ARQUIVADO',
] as const
export type StatusDoProcesso = typeof STATUS_DO_PROCESSO[number]
