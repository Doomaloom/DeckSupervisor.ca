const DB_NAME = 'decksupervisor-print-pdf-cache'
const DB_VERSION = 2
const PDF_STORE_NAME = 'printPdfs'

type SchematicPdfCacheEntry = {
  key: string
  sessionId: string
  day: string
  requestHash: string
  blob: Blob
  generatedAt: number
}

const pendingGenerations = new Map<string, Promise<Blob>>()

function hashString(value: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

function getRequestHash(requestKey: string) {
  return hashString(requestKey || 'default')
}

function getEntryKey(sessionId: string, day: string, requestHash: string) {
  return `schematic::${sessionId}::${day}::${requestHash}`
}

function buildDayRangePrefix(sessionId: string, day: string) {
  return `schematic::${sessionId}::${day}::`
}

function buildDayRange(sessionId: string, day: string) {
  const prefix = buildDayRangePrefix(sessionId, day)
  return IDBKeyRange.bound(prefix, `${prefix}\uffff`)
}

function openDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB not available'))
  }
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      const transaction = request.transaction
      if (!db.objectStoreNames.contains(PDF_STORE_NAME)) {
        db.createObjectStore(PDF_STORE_NAME, { keyPath: 'key' })
      }
      if (request.oldVersion < 2) {
        transaction?.objectStore(PDF_STORE_NAME).clear()
      }
    }
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
    request.onsuccess = () => resolve(request.result)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PDF_STORE_NAME, mode)
    const store = transaction.objectStore(PDF_STORE_NAME)
    const request = fn(store)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => db.close()
    transaction.onabort = () => db.close()
  })
}

async function readPrintPdfEntry(
  sessionId: string,
  day: string,
  requestKey: string,
): Promise<SchematicPdfCacheEntry | null> {
  try {
    const requestHash = getRequestHash(requestKey)
    const entry = await withStore<SchematicPdfCacheEntry | undefined>('readonly', store =>
      store.get(getEntryKey(sessionId, day, requestHash)),
    )
    return entry ?? null
  } catch (error) {
    console.error('Failed to read cached schematic PDF', error)
    return null
  }
}

async function writePrintPdfEntry(entry: SchematicPdfCacheEntry): Promise<void> {
  await withStore('readwrite', store => store.put(entry))
}

async function readPrintPdfKeysForDay(
  sessionId: string,
  day: string,
): Promise<IDBValidKey[]> {
  try {
    const keys = await withStore<IDBValidKey[]>('readonly', store => store.getAllKeys(buildDayRange(sessionId, day)))
    return keys ?? []
  } catch (error) {
    console.error('Failed to read cached schematic PDF keys', error)
    return []
  }
}

async function deletePrintPdfKeys(keys: IDBValidKey[]): Promise<void> {
  if (keys.length === 0) {
    return
  }

  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PDF_STORE_NAME, 'readwrite')
    const store = transaction.objectStore(PDF_STORE_NAME)
    keys.forEach(key => {
      store.delete(key)
    })
    transaction.oncomplete = () => {
      db.close()
      resolve()
    }
    transaction.onerror = () => {
      db.close()
      reject(transaction.error ?? new Error('Failed to delete cached print PDFs'))
    }
    transaction.onabort = () => {
      db.close()
      reject(transaction.error ?? new Error('Failed to delete cached print PDFs'))
    }
  })
}

export async function ensureCachedSchematicPdf(
  sessionId: string,
  day: string,
  requestKey: string,
  generate: () => Promise<Blob>,
  options: { force?: boolean } = {},
): Promise<Blob> {
  if (!sessionId || !day || !requestKey) {
    throw new Error('Missing schematic PDF cache context.')
  }

  const requestHash = getRequestHash(requestKey)
  const entryKey = getEntryKey(sessionId, day, requestHash)
  const pending = pendingGenerations.get(entryKey)
  if (pending) {
    return pending
  }

  if (!options.force) {
    const cached = await readPrintPdfEntry(sessionId, day, requestKey)
    if (cached) {
      return cached.blob
    }
  }

  const generation = generate()
    .then(async blob => {
      await writePrintPdfEntry({
        key: entryKey,
        sessionId,
        day,
        requestHash,
        blob,
        generatedAt: Date.now(),
      })
      return blob
    })
    .finally(() => {
      pendingGenerations.delete(entryKey)
    })

  pendingGenerations.set(entryKey, generation)
  return generation
}

export async function invalidateCachedSchematicPdfs(
  sessionId: string,
  day: string,
): Promise<void> {
  if (!sessionId || !day) {
    return
  }

  const keys = await readPrintPdfKeysForDay(sessionId, day)
  if (keys.length === 0) {
    return
  }

  await deletePrintPdfKeys(keys)

  const prefix = buildDayRangePrefix(sessionId, day)
  Array.from(pendingGenerations.keys()).forEach(key => {
    if (key.startsWith(prefix)) {
      pendingGenerations.delete(key)
    }
  })
}
