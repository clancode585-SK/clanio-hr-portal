import { Redirect } from 'expo-router'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/theme/useTheme'

export default function Index() {
  const { ready, token } = useAuth()
  const theme = useTheme()

  if (!ready) {
    return (
      <View style={[styles.center, { backgroundColor: theme.canvas }]}>
        <ActivityIndicator size="large" color={theme.brand} />
      </View>
    )
  }

  return <Redirect href={token ? '/dashboard' : '/login'} />
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
