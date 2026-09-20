import { vi } from 'vitest'
// Node's experimental Web Storage can mask jsdom's localStorage in Vitest.
// Keep a separate browser-shaped persistent store for these unit tests.
export function installLocalStorage() {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    get length() { return values.size },
    clear() { values.clear() },
    getItem(key: string) { return values.get(key) ?? null },
    setItem(key: string, value: string) { values.set(key, value) },
    removeItem(key: string) { values.delete(key) },
    key(index: number) { return [...values.keys()][index] ?? null },
  } satisfies Storage)
}
