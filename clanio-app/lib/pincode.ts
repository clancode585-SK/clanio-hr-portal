type Place = {
  city: string
  state: string
  country: string
}

type PostOffice = {
  District?: string
  State?: string
  Country?: string
  Block?: string
  Name?: string
}

type Reply = {
  Status?: string
  PostOffice?: PostOffice[] | null
}

const cache = new Map<string, Place | null>()

/**
 * India Post ka public API — 6 digit pincode se city, state, country.
 * Network ya pincode galat ho to null, taaki form kabhi na atke.
 */
export async function lookupPincode(pincode: string): Promise<Place | null> {
  const code = pincode.trim()

  if (!/^\d{6}$/.test(code)) {
    return null
  }

  if (cache.has(code)) {
    return cache.get(code) ?? null
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)

    const res = await fetch(`https://api.postalpincode.in/pincode/${code}`, {
      signal: controller.signal,
    })

    clearTimeout(timer)

    if (!res.ok) {
      cache.set(code, null)

      return null
    }

    const body = (await res.json()) as Reply[]
    const first = body?.[0]

    if (first?.Status !== 'Success' || !first.PostOffice?.length) {
      cache.set(code, null)

      return null
    }

    const office = first.PostOffice[0]

    const place: Place = {
      city: office.District ?? '',
      state: office.State ?? '',
      country: office.Country ?? 'India',
    }

    cache.set(code, place)

    return place
  } catch {
    return null
  }
}
