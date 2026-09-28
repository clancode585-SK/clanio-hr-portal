import type { ReactNode } from 'react'
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native'
import { useTheme } from '@/theme/useTheme'

const FRAME_WIDTH = 460
const FRAME_HEIGHT = 900

// Browser badi screen pe app poori chaudai me fail jaati thi — yahan usko phone jaisa frame milta hai
const WIDE_FROM = 760

export function WebFrame({ children }: { children: ReactNode }) {
  const theme = useTheme()
  const { width, height } = useWindowDimensions()

  if (Platform.OS !== 'web' || width < WIDE_FROM) {
    return <>{children}</>
  }

  return (
    <View
      style={[
        styles.backdrop,
        { backgroundColor: theme.name === 'dark' ? '#05070F' : theme.line },
      ]}
    >
      <View
        style={[
          styles.frame,
          {
            backgroundColor: theme.canvas,
            borderColor: theme.line,
            width: FRAME_WIDTH,
            height: Math.min(FRAME_HEIGHT, height - 48),
          },
        ]}
      >
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    borderWidth: 1,
    borderRadius: 28,
    overflow: 'hidden',
    maxWidth: '100%',
  },
})
