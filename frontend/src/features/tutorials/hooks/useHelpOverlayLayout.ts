import { useEffect, useMemo, useState } from 'react'
import { helpOverlayRegistry } from '../helpOverlayRegistry'
import type {
  HelpOverlayDefinition,
  HelpOverlayId,
  HelpOverlayRect,
  HelpOverlayTipPlacement,
  ResolvedHelpOverlayTip,
} from '../helpOverlayTypes'

const HIGHLIGHT_PADDING = 8
const PIN_OFFSET = 18

function getRectWithFallback(element: HTMLElement): HelpOverlayRect | null {
  const rect = element.getBoundingClientRect()
  const computedStyles = window.getComputedStyle(element)
  const fallbackWidth = Number.parseFloat(computedStyles.width) || 0
  const fallbackHeight = Number.parseFloat(computedStyles.height) || 0
  const width = rect.width || fallbackWidth
  const height = rect.height || fallbackHeight

  if (width <= 0 || height <= 0) {
    return null
  }

  return {
    top: rect.top,
    left: rect.left,
    width,
    height,
    right: rect.left + width,
    bottom: rect.top + height,
  }
}

function getPinCoordinates(highlightRect: HelpOverlayRect, placement: HelpOverlayTipPlacement) {
  switch (placement) {
    case 'top-left':
      return { x: highlightRect.left - PIN_OFFSET, y: highlightRect.top - PIN_OFFSET }
    case 'top-right':
      return { x: highlightRect.right - PIN_OFFSET, y: highlightRect.top - PIN_OFFSET }
    case 'bottom-left':
      return { x: highlightRect.left - PIN_OFFSET, y: highlightRect.bottom - PIN_OFFSET }
    case 'bottom-right':
      return { x: highlightRect.right - PIN_OFFSET, y: highlightRect.bottom - PIN_OFFSET }
    case 'center-right':
    default:
      return {
        x: highlightRect.right - PIN_OFFSET,
        y: highlightRect.top + highlightRect.height / 2 - PIN_OFFSET,
      }
  }
}

export function resolveHelpOverlayTips(
  overlay: HelpOverlayDefinition,
  root: ParentNode = document,
): ResolvedHelpOverlayTip[] {
  return overlay.tips
    .slice()
    .sort((left, right) => left.order - right.order)
    .flatMap(tip => {
      const element = root.querySelector(tip.selector)
      if (!(element instanceof HTMLElement)) {
        if (import.meta.env.DEV && !tip.optional) {
          console.warn(`Help overlay anchor not found for selector: ${tip.selector}`)
        }
        return []
      }

      const rect = getRectWithFallback(element)
      if (!rect) {
        if (import.meta.env.DEV && !tip.optional) {
          console.warn(`Help overlay anchor has no visible size for selector: ${tip.selector}`)
        }
        return []
      }

      const highlightRect = {
        top: rect.top - HIGHLIGHT_PADDING,
        left: rect.left - HIGHLIGHT_PADDING,
        width: rect.width + HIGHLIGHT_PADDING * 2,
        height: rect.height + HIGHLIGHT_PADDING * 2,
        right: rect.right + HIGHLIGHT_PADDING,
        bottom: rect.bottom + HIGHLIGHT_PADDING,
      }
      const { x, y } = getPinCoordinates(highlightRect, tip.placement ?? 'center-right')

      return [
        {
          ...tip,
          rect,
          highlightRect,
          pinX: x,
          pinY: y,
        },
      ]
    })
}

export function useHelpOverlayLayout(activeOverlayId: HelpOverlayId | null, isOpen: boolean) {
  const overlay = useMemo(
    () => (activeOverlayId ? helpOverlayRegistry[activeOverlayId] : null),
    [activeOverlayId],
  )
  const [resolvedTips, setResolvedTips] = useState<ResolvedHelpOverlayTip[]>([])
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!isOpen || !overlay) {
      setResolvedTips([])
      setIsReady(false)
      return
    }

    let frameId = 0
    const measure = () => {
      frameId = 0
      setResolvedTips(resolveHelpOverlayTips(overlay))
      setIsReady(true)
    }
    const scheduleMeasure = () => {
      if (frameId) {
        return
      }
      frameId = window.requestAnimationFrame(measure)
    }

    scheduleMeasure()
    window.addEventListener('resize', scheduleMeasure)
    window.addEventListener('scroll', scheduleMeasure, true)

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId)
      }
      window.removeEventListener('resize', scheduleMeasure)
      window.removeEventListener('scroll', scheduleMeasure, true)
    }
  }, [isOpen, overlay])

  return {
    overlay,
    resolvedTips,
    isReady,
  }
}
