import { Platform, useWindowDimensions, type ViewStyle } from 'react-native'

// WebFrame se match karna zaroori hai — dono jagah same number
const FRAME_WIDTH = 460
const FRAME_HEIGHT = 900
const WIDE_FROM = 760
const GUTTER = 48

type SheetFrame = Pick<ViewStyle, 'alignSelf' | 'width' | 'maxWidth' | 'marginBottom'>

/**
 * Modal react-native-web par document root me jaata hai, isliye wo phone frame ke
 * bahar nikal jaata tha. Ye style usko wapas frame ke andar le aati hai.
 */
export function useSheetFrame(): SheetFrame {
  const { width, height } = useWindowDimensions()

  if (Platform.OS !== 'web' || width < WIDE_FROM) {
    return {}
  }

  const frameHeight = Math.min(FRAME_HEIGHT, height - GUTTER)

  return {
    alignSelf: 'center',
    width: '100%',
    maxWidth: FRAME_WIDTH,
    marginBottom: Math.max(0, Math.round((height - frameHeight) / 2)),
  }
}
