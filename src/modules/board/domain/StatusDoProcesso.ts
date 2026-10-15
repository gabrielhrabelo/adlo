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

// Colunas criadas quando o board é criado sem colunas: uma por etapa do processo
export const COLUNAS_PADRAO: readonly { nome: string, status: StatusDoProcesso }[] = [
  { nome: 'Triagem', status: 'TRIAGEM' },
  { nome: 'Documentação', status: 'DOCUMENTACAO' },
  { nome: 'Protocolo', status: 'PROTOCOLO' },
  { nome: 'Em andamento', status: 'EM_ANDAMENTO' },
  { nome: 'Aguardando', status: 'AGUARDANDO' },
  { nome: 'Concluído', status: 'CONCLUIDO' },
]
