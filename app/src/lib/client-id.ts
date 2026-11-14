const KEY = 'fs-client-id'

/** Identificador anónimo por navegador (no hay login). */
export function clientId(): string {
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return 'anonymous'
  }
}
