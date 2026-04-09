import { createClient } from '@supabase/supabase-js';

// Retrieve environment variables for Supabase connection. 
// The '!' tells TypeScript we guarantee these are defined.
const supabaseUrl = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SUPABASE_URL 
  ? process.env.NEXT_PUBLIC_SUPABASE_URL 
  : '';
  
const supabaseAnonKey = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY 
  ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY 
  : '';

// Initialize and export the single shared Supabase client instance.
// This allows any component to import 'supabase' to query the db or trigger auth.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
