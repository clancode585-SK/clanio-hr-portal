import { useEffect } from 'react'
import { Redirect, usePathname, useRouter } from 'expo-router'
import { Drawer } from 'expo-router/drawer'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { DrawerContent } from '@/components/DrawerContent'
import { NotificationToast } from '@/components/NotificationToast'
import { configurePush } from '@/lib/push'
import { PolicyGateScreen } from '@/components/PolicyGateScreen'
import { ProfileNudge } from '@/components/ProfileNudge'
import { ProfileSetupScreen } from '@/components/ProfileSetupScreen'
import { TourScreen } from '@/components/TourScreen'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/theme/useTheme'

// Platform console par super admin ko sirf ye screens milti hain — baaki kisi company ki hain
const PLATFORM_ROUTES = [
  '/dashboard',
  '/companies',
  '/plans',
  '/billing',
  '/revenue',
  '/platform-permissions',
  '/notifications',
  '/profile',
]

export default function AppLayout() {
  const theme = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const { ready, token, policyBlocked, onboardingStep, isSuperAdmin, companyId } = useAuth()

  useEffect(() => configurePush((url) => router.push(url as never)), [router])

  useEffect(() => {
    if (ready && !token) {
      router.replace('/login')
    }
  }, [ready, router, token])

  // Platform console par company-wali screen ka koi matlab nahi — chupchap wapas bhej do
  const offLimits =
    isSuperAdmin &&
    companyId === null &&
    !PLATFORM_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))

  useEffect(() => {
    if (ready && token && offLimits) {
      router.replace('/dashboard')
    }
  }, [offLimits, ready, router, token])

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

  if (policyBlocked || onboardingStep === 'policies') {
    return <PolicyGateScreen />
  }

  if (onboardingStep === 'profile') {
    return <ProfileSetupScreen />
  }

  if (onboardingStep === 'tour') {
    return <TourScreen />
  }

  return (
    <View style={styles.flex}>
      <ProfileNudge />

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

      <NotificationToast />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
