export const ATTENDANCE_PAGE = {
  width: 792,
  height: 612,
  margin: 19.2,
  backgroundColor: '#ffffff',
  textColor: '#000000',
} as const

export const ATTENDANCE_PRINTABLE = {
  width: ATTENDANCE_PAGE.width - ATTENDANCE_PAGE.margin * 2,
  height: ATTENDANCE_PAGE.height - ATTENDANCE_PAGE.margin * 2,
} as const

export const ATTENDANCE_FRONT_STYLE = {
  titleFontSize: 18,
  metadataFontSize: 12,
  rotatedHeadingFontSize: 7.5,
  studentFontSize: 7.5,
  attendanceFontSize: 7.5,
  dayLabelFontSize: 8.25,
  dayLabelColor: 'rgb(98,98,98)',
  lineHeight: 1.25,
  borderWidth: 0.75,
  studentRowMinHeight: 42,
  headerHorizontalPadding: 9,
  detailsTop: 42,
} as const

export const ATTENDANCE_BACK_STYLE = {
  logicalWidth: 1200,
  scale: ATTENDANCE_PRINTABLE.width / 1200,
  columnGap: 5.024,
  cellPadding: 2.512,
  fontSize: 4.71,
  lineHeight: 1.25,
  blockMarginBottom: 4.71,
  bulletIndent: 5.65,
} as const

export const ATTENDANCE_PRIVATE_STYLE = {
  columnGap: 6.28,
  fontSize: 5.42,
  lineHeight: 1.05,
  blockMarginBottom: 1.88,
} as const

export const ATTENDANCE_PAIR = {
  gap: 15,
  slotHeight: (ATTENDANCE_PRINTABLE.height - 15) / 2,
} as const
