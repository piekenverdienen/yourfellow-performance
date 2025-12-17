import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase env vars missing in client')
    // Return a dummy client that won't crash
    return null as any
  }

  return createBrowserClient(supabaseUrl, supabaseKey)
}
