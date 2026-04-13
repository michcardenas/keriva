import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // On web, Supabase sends auth callbacks via URL hash fragments
    // (e.g. #access_token=xxx&type=recovery). This option tells the
    // client to automatically detect and exchange those tokens for a session.
    detectSessionInUrl: Platform.OS === 'web',
    persistSession: true,
    autoRefreshToken: true,
  },
});
