import { config } from './config'

let companyId: string | null = null
let listener: ((value: string | null) => void) | null = null

export function currentCompanyId(): string | null {
  return companyId
}

export function setCompanyId(value: string | null): void {
  companyId = value
  listener?.(value)
}

export function resetCompanyId(): void {
  setCompanyId(config.companyId)
}

export function onCompanyChange(handler: ((value: string | null) => void) | null): void {
  listener = handler
}
