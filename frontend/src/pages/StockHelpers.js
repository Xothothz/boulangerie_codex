export const formatWeekValue = (date) => {
  const target = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  )
  const dayNumber = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((target - yearStart) / 86400000 + 1) / 7)
  const year = target.getUTCFullYear()
  return `${year}-W${String(week).padStart(2, '0')}`
}

export const getFilenameFromDisposition = (header, fallback) => {
  if (!header) return fallback
  const match = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(header)
  if (match?.[1]) {
    return match[1].replace(/['"]/g, '')
  }
  return fallback
}
