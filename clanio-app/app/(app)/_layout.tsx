import { useEffect } from 'react'
import { Redirect, useRouter } from 'expo-router'
import { Drawer } from 'expo-router/drawer'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { DrawerContent } from '@/components/DrawerContent'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/theme/useTheme'

export default function AppLayout() {
  const theme = useTheme()
  const router = useRouter()
  const { ready, token } = useAuth()

  useEffect(() => {
    if (ready && !token) {
      router.replace('/login')
    }
  }, [ready, router, token])

  if (!ready) {
    return (
      <View style={[styles.center, { backgroundColor: theme.canvas }]}>
        <ActivityIndicator size="large" color={theme.brand} />
      </View>
    )
  }

  if (!token) {
    return <Redirect href="/login" />
  }

  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        drawerStyle: { width: 288, backgroundColor: theme.surface },
        sceneStyle: { backgroundColor: theme.canvas },
        overlayColor: 'rgba(0,0,0,0.35)',
      }}
    />
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
