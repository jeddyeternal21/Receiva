import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    flowType: 'pkce',            // More secure than implicit grant
    persistSession: true,        // Keep session across page reloads
    detectSessionInUrl: true,    // Handle OAuth redirects
    autoRefreshToken: true,      // Auto-refresh before expiry
  },
  global: {
    headers: {
      'X-Client-Info': 'receiva-web/1.0',  // Identify our client in Supabase logs
    },
  },
})