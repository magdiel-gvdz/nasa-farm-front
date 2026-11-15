const KEY = 'fs-client-id'
let memoryId: string | undefined

/** Identificador anónimo por navegador (no hay login). */
export function clientId(): string {
  try {
    let id = localStorage.getItem(KEY)
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      id = crypto.randomUUID()
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    memoryId ??= crypto.randomUUID()
    return memoryId
  }
}
