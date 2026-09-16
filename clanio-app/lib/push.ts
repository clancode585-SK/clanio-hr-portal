import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { api } from './api'

type Registered = {
  token: string
  platform: string
}

let registered: Registered | null = null
let responseSubscription: { remove: () => void } | null = null

export function configurePush(onOpen: (url: string) => void): () => void {
  if (Platform.OS === 'web') {
    return () => undefined
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  })

  responseSubscription?.remove()

  responseSubscription = Notifications.addNotificationResponseReceivedListener((event) => {
    const data = event.notification.request.content.data as Record<string, unknown> | undefined
    const url = typeof data?.action_url === 'string' ? data.action_url : null

    if (url && url.startsWith('/')) {
      onOpen(url)
    }
  })

  return () => {
    responseSubscription?.remove()
    responseSubscription = null
  }
}

export async function registerPush(): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice || registered !== null) {
    return
  }

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Clanio',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3395FF',
      })
    }

    const existing = await Notifications.getPermissionsAsync()
    let status = existing.status

    if (status !== 'granted') {
      const asked = await Notifications.requestPermissionsAsync()
      status = asked.status
    }

    if (status !== 'granted') {
      return
    }

    const device = await Notifications.getDevicePushTokenAsync()
    const token = String(device.data)

    if (!token) {
      return
    }

    await api('/devices', {
      method: 'POST',
      body: {
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        token,
        device_id: Device.osInternalBuildId ?? Device.modelId ?? undefined,
        device_name: Device.deviceName ?? Device.modelName ?? undefined,
        app_version: Constants.expoConfig?.version ?? undefined,
      },
    })

    registered = { token, platform: Platform.OS }
  } catch {
    registered = null
  }
}

export async function unregisterPush(): Promise<void> {
  if (registered === null) {
    return
  }

  const held = registered
  registered = null

  try {
    const devices = await api<Record<string, any>[]>('/devices')
    const mine = devices.find((row) => row.token === held.token)

    if (mine) {
      await api(`/devices/${mine.uuid ?? mine.id}`, { method: 'DELETE' })
    }
  } catch {
    registered = null
  }
}
