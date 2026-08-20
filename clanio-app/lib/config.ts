import Constants from 'expo-constants'

type Extra = {
  apiUrl?: string
  companyId?: string
}

const extra = (Constants.expoConfig?.extra ?? {}) as Extra

function resolveHost(url: string): string {
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    return url
  }

  const hostUri = Constants.expoConfig?.hostUri ?? ''
  const host = hostUri.split(':')[0]

  if (!host || host === 'localhost' || host === '127.0.0.1') {
    return url
  }

  return url.replace('localhost', host).replace('127.0.0.1', host)
}

export const config = {
  apiUrl: resolveHost(extra.apiUrl ?? 'http://localhost/clanio-hr-portal/backend/public/api/hrms'),
  companyId: extra.companyId ?? '1',
  appName: 'Clanio',
} as const
