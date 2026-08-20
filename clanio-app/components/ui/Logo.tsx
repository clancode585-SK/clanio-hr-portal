import { Image, StyleSheet, View } from 'react-native'

type Props = {
  size?: number
}

export function Logo({ size = 40 }: Props) {
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size * 0.26 }]}>
      <Image source={require('@/assets/logo-mark.png')} style={{ width: size, height: size }} resizeMode="cover" />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#0B1236',
    overflow: 'hidden',
  },
})
