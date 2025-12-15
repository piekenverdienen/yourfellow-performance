'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Hook that persists state to localStorage
 * Works correctly with SSR/hydration in Next.js
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const storageKey = `state-${key}`
  const isInitialized = useRef(false)

  // Initialize with a function to avoid SSR issues
  const [value, setValue] = useState<T>(() => {
    // Only run on client
    if (typeof window === 'undefined') {
      return initialValue
    }

    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (e) {
      console.error(`Failed to load state for ${key}:`, e)
    }
    return initialValue
  })

  const [isLoaded, setIsLoaded] = useState(false)

  // Mark as loaded after hydration
  useEffect(() => {
    setIsLoaded(true)
    isInitialized.current = true
  }, [])

  // Save to localStorage when value changes (but not on initial load)
  useEffect(() => {
    if (!isInitialized.current) return

    try {
      localStorage.setItem(storageKey, JSON.stringify(value))
    } catch (e) {
      console.error(`Failed to save state for ${key}:`, e)
    }
  }, [value, storageKey, key])

  return [value, setValue, isLoaded]
}

/**
 * Hook that persists form data to localStorage with reset function
 */
export function usePersistedForm<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void, boolean] {
  const [value, setValue, isLoaded] = usePersistedState(key, initialValue)
  const storageKey = `state-${key}`

  const reset = useCallback(() => {
    setValue(initialValue)
    try {
      localStorage.removeItem(storageKey)
    } catch (e) {
      console.error(`Failed to clear form data for ${key}:`, e)
    }
  }, [initialValue, storageKey, key, setValue])

  return [value, setValue, reset, isLoaded]
}
