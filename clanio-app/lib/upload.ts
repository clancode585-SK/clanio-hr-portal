import * as DocumentPicker from 'expo-document-picker'

export type PickedFile = {
  uri: string
  name: string
  mimeType: string
  size: number | null
}

export async function pickFile(types: string[]): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: types,
    copyToCacheDirectory: true,
    multiple: false,
  })

  if (result.canceled || result.assets.length === 0) {
    return null
  }

  const asset = result.assets[0]

  return {
    uri: asset.uri,
    name: asset.name ?? 'upload',
    mimeType: asset.mimeType ?? 'application/octet-stream',
    size: asset.size ?? null,
  }
}

export function toFormData(file: PickedFile, key: string, fields: Record<string, unknown> = {}): FormData {
  const form = new FormData()

  form.append(key, {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as unknown as Blob)

  for (const [name, value] of Object.entries(fields)) {
    if (value === null || value === undefined || value === '') {
      continue
    }

    form.append(name, String(value))
  }

  return form
}

export const imageAndPdf = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

export const documentTypes = [
  ...imageAndPdf,
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]
