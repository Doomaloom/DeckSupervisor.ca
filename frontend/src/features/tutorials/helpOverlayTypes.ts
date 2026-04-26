export type HelpOverlayId =
  | 'dashboard'
  | 'manage-session'
  | 'schematic'
  | 'rosters'
  | 'print'
  | 'requests'
  | 'attendance-sheets'

export type HelpOverlayTipPlacement =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center-right'

export type HelpOverlayTip = {
  id: string
  title: string
  body: string[]
  selector: string
  order: number
  placement?: HelpOverlayTipPlacement
  mobilePlacement?: 'sheet'
  optional?: boolean
}

export type HelpOverlayDefinition = {
  id: HelpOverlayId
  routePaths: string[]
  title: string
  introTitle: string
  introBody: string[]
  unsupportedMessage?: string
  tips: HelpOverlayTip[]
}

export type HelpOverlayRect = {
  top: number
  left: number
  width: number
  height: number
  right: number
  bottom: number
}

export type ResolvedHelpOverlayTip = HelpOverlayTip & {
  rect: HelpOverlayRect
  highlightRect: HelpOverlayRect
  pinX: number
  pinY: number
}
