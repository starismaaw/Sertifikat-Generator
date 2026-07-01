// scripts/copy-fonts.mjs
// Salin WOFF font files dari @fontsource ke public/fonts/
// @pdf-lib/fontkit mendukung WOFF (bukan hanya TTF)

import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const FONTS = [
  { pkg: 'playfair-display', out: 'PlayfairDisplay', hasItalic: true,  hasSemiBold: true },
  { pkg: 'eb-garamond',      out: 'EBGaramond',      hasItalic: true,  hasSemiBold: true },
  { pkg: 'cinzel',           out: 'Cinzel',           hasItalic: false, hasSemiBold: true },
  { pkg: 'merriweather',     out: 'Merriweather',     hasItalic: true,  hasSemiBold: true },
  { pkg: 'lato',             out: 'Lato',             hasItalic: true,  hasSemiBold: false },
  { pkg: 'montserrat',       out: 'Montserrat',       hasItalic: true,  hasSemiBold: true },
  { pkg: 'roboto',           out: 'Roboto',           hasItalic: true,  hasSemiBold: true },
  { pkg: 'open-sans',        out: 'OpenSans',         hasItalic: true,  hasSemiBold: true },
  { pkg: 'raleway',          out: 'Raleway',          hasItalic: true,  hasSemiBold: true },
  { pkg: 'noto-serif',       out: 'NotoSerif',        hasItalic: true,  hasSemiBold: true },
]

mkdirSync('public/fonts', { recursive: true })

let copied = 0
let missing = 0

for (const font of FONTS) {
  const copyFont = (weight, name, style) => {
    const src = resolve(`node_modules/@fontsource/${font.pkg}/files/${font.pkg}-latin-${weight}-${style}.woff`)
    const dest = `public/fonts/${font.out}-${name}.woff`
    if (existsSync(src)) {
      copyFileSync(src, dest)
      console.log(`✓ ${dest}`)
      copied++
    } else {
      console.error(`✗ MISSING: ${src}`)
      missing++
    }
  }

  copyFont(400, 'Regular',    'normal')
  copyFont(700, 'Bold',       'normal')
  if (font.hasItalic) {
    copyFont(400, 'Italic',     'italic')
    copyFont(700, 'BoldItalic', 'italic')
  }
  if (font.hasSemiBold) {
    copyFont(600, 'SemiBold', 'normal')
    if (font.hasItalic) {
      copyFont(600, 'SemiBoldItalic', 'italic')
    }
  }
}

console.log(`\nDone: ${copied} copied, ${missing} missing`)
if (missing > 0) process.exit(1)
