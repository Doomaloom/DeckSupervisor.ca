export function timeToMinutes(time: string) {
    const [hours, minutes] = time.split(':').map(Number)
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        return 0
    }
    return hours * 60 + minutes
}

export function buildTimeLabels(start: string, end: string): string[] {
    if (!start || !end) {
        return []
    }
    const labels: string[] = []
    const startDate = new Date(`1970-01-01T${start}:00`)
    const endDate = new Date(`1970-01-01T${end}:00`)
    const startMinutes = startDate.getMinutes()
    if (startMinutes % 15 !== 0) {
        startDate.setMinutes(startMinutes - (startMinutes % 15), 0, 0)
    }
    const endMinutes = endDate.getMinutes()
    if (endMinutes % 15 !== 0) {
        endDate.setMinutes(endMinutes + (15 - (endMinutes % 15)), 0, 0)
    }
    let current = startDate
    while (current < endDate) {
        labels.push(current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }))
        current = new Date(current.getTime() + 15 * 60000)
    }
    return labels
}
