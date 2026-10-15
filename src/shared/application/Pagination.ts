export interface PageRequest {
  page?: number
  pageSize?: number
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export const MAX_PAGE_SIZE = 100

export function normalizePage(input: PageRequest): { page: number, pageSize: number, skip: number } {
  const page = Math.max(1, Math.trunc(input.page ?? 1))
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(input.pageSize ?? 20)))

  return { page, pageSize, skip: (page - 1) * pageSize }
}

// JSON schema da querystring de paginação, para compor nas rotas
export const pageQuerySchema = {
  page: { type: 'integer', minimum: 1, default: 1 },
  pageSize: { type: 'integer', minimum: 1, maximum: MAX_PAGE_SIZE, default: 20 },
} as const
