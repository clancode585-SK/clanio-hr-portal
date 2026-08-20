import { useCallback, useEffect, useState } from 'react'
import { ApiError } from './api'

type State<T> = {
  data: T | null
  loading: boolean
  refreshing: boolean
  error: string | null
  reload: () => Promise<void>
  refresh: () => Promise<void>
  setData: (value: T | null) => void
}

export function useResource<T>(loader: () => Promise<T>, deps: unknown[] = []): State<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async (mode: 'load' | 'refresh') => {
      if (mode === 'load') {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      setError(null)

      try {
        const result = await loader()

        setData(result)
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Could not load data.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps
  )

  useEffect(() => {
    void run('load')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return {
    data,
    loading,
    refreshing,
    error,
    reload: () => run('load'),
    refresh: () => run('refresh'),
    setData,
  }
}
