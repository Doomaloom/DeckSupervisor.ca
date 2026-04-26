import type { HelpOverlayId } from './helpOverlayTypes'

const routeHelpOverlayMap: Record<string, HelpOverlayId> = {
  '/': 'dashboard',
  '/manage-sessions': 'manage-session',
  '/schematic': 'schematic',
  '/rosters': 'rosters',
  '/print': 'print',
  '/full-timer-tools/attendance-sheets': 'attendance-sheets',
}

export function routeToHelpOverlayId(pathname: string, search?: string): HelpOverlayId | null {
  if (pathname === '/rosters' && search && new URLSearchParams(search).get('view') === 'requests') {
    return 'requests'
  }
  return routeHelpOverlayMap[pathname] ?? null
}
