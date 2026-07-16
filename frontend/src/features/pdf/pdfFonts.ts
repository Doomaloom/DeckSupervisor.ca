import { Font } from '@react-pdf/renderer'
import sansBold from './fonts/LiberationSans-Bold.ttf?url'
import sansBoldItalic from './fonts/LiberationSans-BoldItalic.ttf?url'
import sansItalic from './fonts/LiberationSans-Italic.ttf?url'
import sansRegular from './fonts/LiberationSans-Regular.ttf?url'
import serifBold from './fonts/LiberationSerif-Bold.ttf?url'
import serifBoldItalic from './fonts/LiberationSerif-BoldItalic.ttf?url'
import serifItalic from './fonts/LiberationSerif-Italic.ttf?url'
import serifRegular from './fonts/LiberationSerif-Regular.ttf?url'

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
