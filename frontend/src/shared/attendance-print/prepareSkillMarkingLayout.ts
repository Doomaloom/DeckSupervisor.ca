// Rotating the header swaps its width and height. Measure the actual font layout
// rather than assuming a character count fits both regular and bold labels.
export function prepareSkillMarkingLayout(document: Document) {
    const view = document.defaultView;
    if (!view) return;
    document.querySelectorAll<HTMLElement>(".marking-criterion > span").forEach((label) => {
        const cell = label.parentElement!;
        const available = cell.clientWidth - 8;
        if (available <= 0 || cell.clientHeight <= 0) return;

        // Reset before measuring so repeated preview/print passes are stable.
        label.style.removeProperty("font-size");
        label.style.removeProperty("transform");
        const baseSize = parseFloat(view.getComputedStyle(label).fontSize);
        let fontSize = baseSize;
        while (label.offsetHeight > available && fontSize > 7.5) {
            fontSize = Math.max(7.5, fontSize - 0.25);
            label.style.fontSize = `${fontSize}px`;
        }

        // Exceptionally wide text can still need more than the available lines.
        // Condense that label across the column without clipping any characters.
        if (label.offsetHeight > available) {
            label.style.transform = `rotate(-90deg) scaleY(${available / label.offsetHeight})`;
        }
    });
}
