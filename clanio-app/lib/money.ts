export const Money = {
  indian(value: number | string | null | undefined, decimals = 0): string {
    const amount = Number(value ?? 0)

    if (!Number.isFinite(amount)) {
      return '0'
    }

    return amount.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  },

  rupee(value: number | string | null | undefined, decimals = 0): string {
    return '₹' + Money.indian(value, decimals)
  },

  short(value: number | string | null | undefined): string {
    const amount = Number(value ?? 0)

    if (!Number.isFinite(amount) || amount === 0) {
      return '₹0'
    }

    const sign = amount < 0 ? '-' : ''
    const size = Math.abs(amount)

    if (size >= 10000000) {
      return sign + '₹' + trim(size / 10000000) + 'Cr'
    }

    if (size >= 100000) {
      return sign + '₹' + trim(size / 100000) + 'L'
    }

    if (size >= 1000) {
      return sign + '₹' + trim(size / 1000) + 'K'
    }

    return sign + '₹' + Math.round(size)
  },

  days(value: number | string | null | undefined): string {
    const amount = Number(value ?? 0)

    return Number.isInteger(amount) ? String(amount) : amount.toFixed(1)
  },
}

function trim(value: number): string {
  return value >= 10 ? String(Math.round(value)) : String(Math.round(value * 10) / 10)
}
