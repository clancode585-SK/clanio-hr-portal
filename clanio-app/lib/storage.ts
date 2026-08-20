import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

const web = Platform.OS === 'web'

export async function readItem(key: string): Promise<string | null> {
  if (web) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null
    } catch {
      return null
    }
  }

  return SecureStore.getItemAsync(key).catch(() => null)
}

export async function writeItem(key: string, value: string): Promise<void> {
  if (web) {
    try {
      globalThis.localStorage?.setItem(key, value)
    } catch {
      return
    }

    return
  }

  await SecureStore.setItemAsync(key, value)
}

export async function removeItem(key: string): Promise<void> {
  if (web) {
    try {
      globalThis.localStorage?.removeItem(key)
    } catch {
      return
    }

    return
  }

  await SecureStore.deleteItemAsync(key).catch(() => undefined)
}
