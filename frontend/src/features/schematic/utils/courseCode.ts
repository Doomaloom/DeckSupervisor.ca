export function normalizeCourseCodeForCompare(value: string | null | undefined) {
    const trimmed = (value ?? '').trim()
    if (!trimmed) {
        return ''
    }
    if (!/^\d+$/.test(trimmed)) {
        return trimmed
    }
    const stripped = trimmed.replace(/^0+/, '')
    return stripped || '0'
}
