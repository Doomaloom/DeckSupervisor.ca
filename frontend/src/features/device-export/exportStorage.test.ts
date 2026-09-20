import { installLocalStorage } from './testStorage'
import { beforeEach, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { buildCourses, buildPackage, newRegistry } from './exportPackage'
import { loadRegistry, restoreRegistry, saveRegistry } from './exportStorage'
import { setStorageScope } from '../../lib/storageScope'
import { classes, students, session } from './fixtures'
beforeEach(() => { vi.stubGlobal('crypto', webcrypto); installLocalStorage(); window.localStorage.clear(); setStorageScope('export-test') })
it('retains identity through reload, backup restore and re-export', async () => {
  const courses = buildCourses(session, classes, students)
  const first = await buildPackage(session.id, 'Alex', courses, newRegistry(session.id))
  saveRegistry(first.registry)
  const backup = JSON.stringify(loadRegistry(session.id))
  window.localStorage.clear()
  restoreRegistry(backup, session.id)
  const restored = await buildPackage(session.id, 'Alex', courses, loadRegistry(session.id)!)
  expect(restored.package).toEqual(first.package)
  setStorageScope('another-user')
  expect(loadRegistry(session.id)).toBeNull()
})
it('refuses to overwrite existing mappings or mix datasets', async () => {
  const first = await buildPackage(session.id, 'Alex', buildCourses(session, classes, students), newRegistry(session.id))
  saveRegistry(first.registry)
  expect(() => saveRegistry(newRegistry(session.id))).toThrow('different export IDs')
  expect(() => restoreRegistry(JSON.stringify(newRegistry('other-session')), session.id)).toThrow('selected session')
  const bad = structuredClone(first.registry)
  Object.values(bad.people)[0].sourceId = 'changed'
  expect(() => restoreRegistry(JSON.stringify(bad), session.id)).toThrow('conflicts')
  expect(loadRegistry(session.id)).toEqual(first.registry)
})
