type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const memoryStorage = new Map<string, string>()

function getSessionStorage(): StorageLike | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.sessionStorage
  } catch (error) {
    console.error('Session storage is unavailable', error)
    return null
  }
}

export function getStoredItem(key: string): string | null {
  const storage = getSessionStorage()
  if (storage) {
    return storage.getItem(key)
  }
  return memoryStorage.get(key) ?? null
}

export function setStoredItem(key: string, value: string) {
  const storage = getSessionStorage()
  if (storage) {
    storage.setItem(key, value)
    return
  }
  memoryStorage.set(key, value)
}

export function removeStoredItem(key: string) {
  const storage = getSessionStorage()
  if (storage) {
    storage.removeItem(key)
    return
  }
  memoryStorage.delete(key)
}

export const supabaseSessionStorage = {
  getItem(key: string) {
    return getStoredItem(key)
  },
  setItem(key: string, value: string) {
    setStoredItem(key, value)
  },
  removeItem(key: string) {
    removeStoredItem(key)
  },
}
