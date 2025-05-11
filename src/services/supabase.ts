/**
 * Supabase 服务
 *
 * 这个文件提供了获取 Supabase 客户端实例的函数
 */

import { createClient } from '@supabase/supabase-js';

// 创建 Supabase 客户端实例
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// 创建 Supabase 客户端实例
const supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
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

/**
 * 获取 Supabase 客户端实例
 * @returns Supabase 客户端实例
 */
export function getSupabase() {
  return supabaseInstance;
}
