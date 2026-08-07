export const LEGACY_ATTENDANCE_TEMPLATE_KEYS = [
  'LittleSplash1',
  'LittleSplash2',
  'LittleSplash3',
  'LittleSplash4',
  'LittleSplash5',
  'ParentandTot1',
  'ParentandTot2',
  'ParentandTot3',
  'Splash1',
  'Splash2A',
  'Splash2B',
  'Splash3',
  'Splash4',
  'Splash5',
  'Splash6',
  'Splash7',
  'Splash8',
  'Splash9',
  'SplashFitness',
  'SplashPrivate',
  'TeenAdult1',
  'TeenAdult2',
  'TeenAdult3',
] as const

export type LegacyAttendanceTemplateKey = typeof LEGACY_ATTENDANCE_TEMPLATE_KEYS[number]

export type LoadedAttendanceTemplate = {
  key: LegacyAttendanceTemplateKey
  html: string
}

type RawTemplateModule = { default: string }
type RawTemplateLoader = () => Promise<RawTemplateModule>

const rawTemplateModules = import.meta.glob('./templates/*.html', {
  query: '?raw',
}) as Record<string, RawTemplateLoader>

const templateKeys = new Set<string>(LEGACY_ATTENDANCE_TEMPLATE_KEYS)

export function normalizeAttendanceTemplateKey(value: string): LegacyAttendanceTemplateKey {
  const normalized = value.trim().replace(/\.html$/i, '').replace(/[\s/]+/g, '')
  return templateKeys.has(normalized) ? normalized as LegacyAttendanceTemplateKey : 'SplashFitness'
}

export async function loadAttendanceTemplate(value: string): Promise<LoadedAttendanceTemplate> {
  const key = normalizeAttendanceTemplateKey(value)
  const loader = rawTemplateModules[`./templates/${key}.html`]
  if (!loader) {
    throw new Error(`Attendance template ${key} is unavailable.`)
  }
  const module = await loader()
  return { key, html: module.default }
}
