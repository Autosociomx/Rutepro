/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Retrieve public client-side variables (never include service_role or admin secrets here)
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabasePublishableKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim();

/**
 * Validates whether the Supabase environment is properly configured.
 */
export function validateSupabaseConfig(): { isValid: boolean; error?: string } {
  if (!supabaseUrl) {
    return {
      isValid: false,
      error: 'VITE_SUPABASE_URL no está configurada.',
    };
  }

  if (!supabaseUrl.startsWith('https://') && !supabaseUrl.startsWith('http://')) {
    return {
      isValid: false,
      error: 'VITE_SUPABASE_URL debe ser una URL válida (http:// o https://).',
    };
  }

  if (!supabasePublishableKey) {
    return {
      isValid: false,
      error: 'VITE_SUPABASE_PUBLISHABLE_KEY (o anon key) no está configurada.',
    };
  }

  return { isValid: true };
}

const configValidation = validateSupabaseConfig();
export const isSupabaseConfigured = configValidation.isValid;

if (!isSupabaseConfigured) {
  console.warn(
    `[Supabase] ${configValidation.error} El sistema operará en Modo DEMO o requerirá credenciales en .env`
  );
}

// Client instance: safe fallback so client modules do not crash on load if env vars are pending
export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabasePublishableKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
