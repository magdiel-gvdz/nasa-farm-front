export class ApiError extends Error {
  status: number
  code: string
  details: Record<string, unknown>
  retryAfter: number | null

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}, retryAfter: number | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.retryAfter = retryAfter
  }
}

export async function responseError(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => ({}))
  const retry = res.headers.get('Retry-After')
  return new ApiError(res.status, body?.error?.code ?? 'http_error', body?.error?.message ?? `Request failed (${res.status})`, body?.error?.details ?? {}, retry == null ? null : Number(retry))
}
