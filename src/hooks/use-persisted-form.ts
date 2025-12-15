'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Hook that persists form data to localStorage
 * Data survives page navigation, tab switches, and browser refresh
 *
 * @param key - Unique key for localStorage (e.g., 'seo-meta-form')
 * @param initialValue - Default value when no saved data exists
 * @returns [value, setValue, reset] - State value, setter, and reset function
 */
export function usePersistedForm<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void, boolean] {
  const storageKey = `form-${key}`
  const [isLoaded, setIsLoaded] = useState(false)
  const [value, setValue] = useState<T>(initialValue)

  // Load saved data from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        setValue(parsed)
      }
    } catch (e) {
      console.error(`Failed to load form data for ${key}:`, e)
    }
    setIsLoaded(true)
  }, [storageKey, key])

  // Save to localStorage when value changes
  useEffect(() => {
    if (!isLoaded) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(value))
    } catch (e) {
      console.error(`Failed to save form data for ${key}:`, e)
    }
  }, [value, isLoaded, storageKey, key])

  // Reset to initial value and clear storage
  const reset = useCallback(() => {
    setValue(initialValue)
    try {
      localStorage.removeItem(storageKey)
    } catch (e) {
      console.error(`Failed to clear form data for ${key}:`, e)
    }
  }, [initialValue, storageKey, key])

  return [value, setValue, reset, isLoaded]
}

/**
 * Hook for persisting multiple related form fields
 * Useful when you have separate state for different parts of a form
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const storageKey = `state-${key}`
  const [isLoaded, setIsLoaded] = useState(false)
  const [value, setValue] = useState<T>(initialValue)

  // Load on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        setValue(JSON.parse(saved))
      }
    } catch (e) {
      console.error(`Failed to load state for ${key}:`, e)
    }
    setIsLoaded(true)
  }, [storageKey, key])

  // Save on change
  useEffect(() => {
    if (!isLoaded) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(value))
    } catch (e) {
      console.error(`Failed to save state for ${key}:`, e)
    }
  }, [value, isLoaded, storageKey, key])

  return [value, setValue, isLoaded]
}
