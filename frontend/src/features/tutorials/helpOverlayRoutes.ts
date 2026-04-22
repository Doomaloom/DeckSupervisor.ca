import type { HelpOverlayId } from './helpOverlayTypes'

const routeHelpOverlayMap: Record<string, HelpOverlayId> = {
  '/manage-sessions': 'manage-session',
  '/schematic': 'schematic',
  '/rosters': 'rosters',
  '/print': 'print',
}

export function routeToHelpOverlayId(pathname: string): HelpOverlayId | null {
  return routeHelpOverlayMap[pathname] ?? null
}
