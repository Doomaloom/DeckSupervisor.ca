export const LEGACY_ATTENDANCE_TEMPLATE_KEYS = [
  'LittleSplash1', 'LittleSplash2', 'LittleSplash3', 'LittleSplash4', 'LittleSplash5',
  'ParentandTot1', 'ParentandTot2', 'ParentandTot3',
  'Splash1', 'Splash2A', 'Splash2B', 'Splash3', 'Splash4', 'Splash5', 'Splash6',
  'Splash7', 'Splash8', 'Splash9', 'SplashFitness', 'SplashPrivate',
  'TeenAdult1', 'TeenAdult2', 'TeenAdult3',
] as const

export type LegacyAttendanceTemplateKey = typeof LEGACY_ATTENDANCE_TEMPLATE_KEYS[number]

const templateLoaders = import.meta.glob<string>('./templates/*.html', {
  query: '?raw',
  import: 'default',
})

const keySet = new Set<string>(LEGACY_ATTENDANCE_TEMPLATE_KEYS)

export function normalizeAttendanceTemplateKey(key: string): LegacyAttendanceTemplateKey {
  const normalized = key.trim().replaceAll(' ', '')
  return (keySet.has(normalized) ? normalized : 'SplashFitness') as LegacyAttendanceTemplateKey
}

export async function loadLegacyAttendanceTemplate(key: string) {
  const normalized = normalizeAttendanceTemplateKey(key)
  const loader = templateLoaders[`./templates/${normalized}.html`]
  if (!loader) throw new Error(`Attendance template ${normalized} is unavailable.`)
  return { key: normalized, html: await loader() }
}
