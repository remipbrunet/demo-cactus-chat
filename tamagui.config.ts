import { createTamagui } from 'tamagui'
import { createInterFont } from '@tamagui/font-inter'
import { shorthands } from '@tamagui/shorthands'
import { themes, tokens } from '@tamagui/themes'

const interFont = createInterFont()

const config = createTamagui({
  fonts: {
    body: interFont,
  },
  tokens,
  themes,
  shorthands,
})

export type AppConfig = typeof config
export default config 