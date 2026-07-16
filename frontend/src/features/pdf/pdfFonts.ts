import { Font } from '@react-pdf/renderer'
const source = (url: URL) => typeof window === 'undefined' && url.protocol === 'file:' ? decodeURIComponent(url.pathname) : url.toString()
const sansBold = source(new URL('./fonts/LiberationSans-Bold.ttf', import.meta.url))
const sansBoldItalic = source(new URL('./fonts/LiberationSans-BoldItalic.ttf', import.meta.url))
const sansItalic = source(new URL('./fonts/LiberationSans-Italic.ttf', import.meta.url))
const sansRegular = source(new URL('./fonts/LiberationSans-Regular.ttf', import.meta.url))
const serifBold = source(new URL('./fonts/LiberationSerif-Bold.ttf', import.meta.url))
const serifBoldItalic = source(new URL('./fonts/LiberationSerif-BoldItalic.ttf', import.meta.url))
const serifItalic = source(new URL('./fonts/LiberationSerif-Italic.ttf', import.meta.url))
const serifRegular = source(new URL('./fonts/LiberationSerif-Regular.ttf', import.meta.url))

let registered = false

export function registerPdfFonts() {
  if (registered) return false
  Font.register({
    family: 'Liberation Sans',
    fonts: [
      { src: sansRegular, fontWeight: 400 },
      { src: sansBold, fontWeight: 700 },
      { src: sansItalic, fontWeight: 400, fontStyle: 'italic' },
      { src: sansBoldItalic, fontWeight: 700, fontStyle: 'italic' },
    ],
  })
  Font.register({
    family: 'Liberation Serif',
    fonts: [
      { src: serifRegular, fontWeight: 400 },
      { src: serifBold, fontWeight: 700 },
      { src: serifItalic, fontWeight: 400, fontStyle: 'italic' },
      { src: serifBoldItalic, fontWeight: 700, fontStyle: 'italic' },
    ],
  })
  registered = true
  return true
}
