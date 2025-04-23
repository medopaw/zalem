import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// 导出工具函数
export { checkSupabaseConnection } from '../utils/supabaseUtils';

// 为了向后兼容，提供一个直接使用默认 supabase 实例的版本
export const checkConnection = async () => {
  const { checkSupabaseConnection } = await import('../utils/supabaseUtils');
  return checkSupabaseConnection(supabase);
};
