import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

export function useCoursePointerDrag(
    enabled: boolean,
    onStart: () => void,
    onDropAt: (x: number, y: number) => void,
    onHoverAt: (x: number | null, y: number | null) => void,
) {
    const callbacks = useRef({ onStart, onDropAt, onHoverAt });
    callbacks.current = { onStart, onDropAt, onHoverAt };
    const cleanup = useRef<(() => void) | null>(null);
    const suppressClick = useRef(false);
    useEffect(() => () => cleanup.current?.(), []);

    const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!enabled || event.button !== 0 || !event.isPrimary) return;
        cleanup.current?.();
        suppressClick.current = false;
        const tile = event.currentTarget;
        const pointerId = event.pointerId;
        const startX = event.clientX;
        const startY = event.clientY;
        const column = tile.closest("[data-schematic-column]");
        const selectedTiles = tile.dataset.courseSelected === "true"
            ? Array.from(column?.querySelectorAll<HTMLDivElement>(
                '[data-course-selected="true"]',
            ) ?? [])
            : [tile];
        const tiles = (selectedTiles.length > 0 ? selectedTiles : [tile]).map(
            (element) => ({
                element,
                rect: element.getBoundingClientRect(),
                originalStyle: element.getAttribute("style"),
            }),
        );
        let moving = false;

        const restore = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", finish);
            window.removeEventListener("pointercancel", cancel);
            window.removeEventListener("keydown", keydown);
            window.removeEventListener("blur", cancel);
            tile.removeEventListener("lostpointercapture", cancel);
            if (moving) callbacks.current.onHoverAt(null, null);
            if (tile.hasPointerCapture(pointerId)) tile.releasePointerCapture(pointerId);
            if (moving) {
                for (const { element, originalStyle } of tiles) {
                    element.hidePopover();
                    element.removeAttribute("popover");
                    if (originalStyle === null) element.removeAttribute("style");
                    else element.setAttribute("style", originalStyle);
                }
            }
            cleanup.current = null;
        };
        const move = (next: PointerEvent) => {
            if (next.pointerId !== pointerId) return;
            const dx = next.clientX - startX;
            const dy = next.clientY - startY;
            if (!moving) {
                if (Math.hypot(dx, dy) < 4) return;
                moving = true;
                suppressClick.current = true;
                callbacks.current.onStart();
                // Lift every selected tile into the top layer while preserving
                // its DOM location and distance from the grabbed tile.
                for (const { element, rect } of tiles) {
                    element.setAttribute("popover", "manual");
                    Object.assign(element.style, {
                        position: "fixed", inset: "auto", margin: "0", padding: "0",
                        left: `${rect.left}px`, top: `${rect.top}px`,
                        width: `${rect.width}px`, height: `${rect.height}px`,
                        maxWidth: "none", maxHeight: "none", boxSizing: "border-box",
                        transform: "none", translate: "none", transition: "none",
                        cursor: "grabbing", pointerEvents: "none",
                    });
                    element.showPopover();
                }
                tile.setPointerCapture(pointerId);
            }
            next.preventDefault();
            for (const { element, rect } of tiles) {
                element.style.left = `${rect.left + dx}px`;
                element.style.top = `${rect.top + dy}px`;
            }
            callbacks.current.onHoverAt(next.clientX, next.clientY);
        };
        const finish = (next: PointerEvent) => {
            if (next.pointerId !== pointerId) return;
            if (!moving) { restore(); return; }
            callbacks.current.onDropAt(next.clientX, next.clientY);
            restore();
        };
        const cancel = () => restore();
        const keydown = (next: KeyboardEvent) => {
            if (next.key === "Escape") { next.preventDefault(); restore(); }
        };
        cleanup.current = restore;
        window.addEventListener("pointermove", move, { passive: false });
        window.addEventListener("pointerup", finish);
        window.addEventListener("pointercancel", cancel);
        window.addEventListener("keydown", keydown);
        window.addEventListener("blur", cancel);
        tile.addEventListener("lostpointercapture", cancel);
    };

    return { onPointerDown, suppressClick };
}
