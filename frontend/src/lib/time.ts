export function convertTo24Hour(time12h: string): string {
  if (!time12h) {
    return '00:00'
  }

  const timePart = time12h.split('-')[0]?.trim() ?? time12h
  const [time, modifier] = timePart.split(' ')
  const [hours = '00', minutes = '00'] = time.split(':')

  let hourNum = Number.parseInt(hours, 10)

  if (modifier === 'PM' && hourNum < 12) {
    hourNum += 12
  }
  if (modifier === 'AM' && hourNum === 12) {
    hourNum = 0
  }

  return `${hourNum.toString().padStart(2, '0')}:${minutes.padStart(2, '0')}`
}

export function extractStartTime(timeRange: string): string {
  if (!timeRange) {
    return '00:00'
  }
  const [start] = timeRange.split('-')
  return convertTo24Hour(start.trim())
}

export function extractEndTime(timeRange: string): string {
  if (!timeRange) {
    return '00:00'
  }
  const parts = timeRange.split('-')
  const end = parts[1] ?? parts[0]
  return convertTo24Hour(end.trim())
}

export function getRunningMinutes(timeRange: string): number {
  const start = extractStartTime(timeRange)
  const end = extractEndTime(timeRange)

  const [startHour, startMinute] = start.split(':').map(Number)
  const [endHour, endMinute] = end.split(':').map(Number)

  return (endHour - startHour) * 60 + (endMinute - startMinute)
}
