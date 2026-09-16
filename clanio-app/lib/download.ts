import { Platform } from 'react-native'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { config } from './config'
import { currentToken } from './session'
import { currentCompanyId } from './tenant'

function authHeaders(accept: string): Record<string, string> {
  const headers: Record<string, string> = { Accept: accept }
  const token = currentToken()
  const company = currentCompanyId()

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (company !== null) {
    headers['X-Company-Id'] = company
  }

  return headers
}

function saveOnWeb(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

async function shareOnDevice(fileName: string, write: (file: File) => void, mimeType: string): Promise<void> {
  const file = new File(Paths.cache, fileName)

  if (file.exists) {
    file.delete()
  }

  file.create()
  write(file)

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('This device cannot open files from the app.')
  }

  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: fileName })
}

export async function downloadText(path: string, fileName: string): Promise<void> {
  const response = await fetch(`${config.apiUrl}${path}`, { headers: authHeaders('text/csv') })

  if (!response.ok) {
    throw new Error('The file could not be prepared. Try again.')
  }

  const body = await response.text()

  if (Platform.OS === 'web') {
    saveOnWeb(new Blob([body], { type: 'text/csv;charset=utf-8;' }), fileName)

    return
  }

  await shareOnDevice(fileName, (file) => file.write(body), 'text/csv')
}

export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const response = await fetch(`${config.apiUrl}${path}`, { headers: authHeaders('*/*') })

  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? 'That file is no longer on the server.'
        : response.status === 403
          ? 'You do not have permission to open this file.'
          : 'The file could not be opened. Try again.'
    )
  }

  const fileName = nameFrom(response.headers.get('content-disposition')) ?? fallbackName
  const mimeType = response.headers.get('content-type') ?? 'application/octet-stream'
  const blob = await response.blob()

  if (Platform.OS === 'web') {
    saveOnWeb(blob, fileName)

    return
  }

  const bytes = new Uint8Array(await blob.arrayBuffer())

  await shareOnDevice(fileName, (file) => file.write(bytes), mimeType)
}

function nameFrom(disposition: string | null): string | null {
  if (!disposition) {
    return null
  }

  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition)

  if (utf8) {
    try {
      return decodeURIComponent(utf8[1])
    } catch {
      return null
    }
  }

  const plain = /filename="?([^";]+)"?/i.exec(disposition)

  return plain ? plain[1].trim() : null
}
