import { StyleSheet, View } from 'react-native'
import { Icon } from '@/components/ui/Icon'
import { useTheme } from '@/theme/useTheme'

type Props = {
  size?: number
  tone?: 'brand' | 'plain'
}

export function Logo({ size = 40, tone = 'brand' }: Props) {
  const theme = useTheme()
  const plain = tone === 'plain'

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size * 0.3,
          backgroundColor: plain ? theme.brandSoft : theme.brand,
        },
      ]}
    >
      <Icon name="people" size={size * 0.52} color={plain ? theme.brand : theme.onBrand} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
