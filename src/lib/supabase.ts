/**
 * Supabase 客户端
 *
 * 这个文件是为了向后兼容而保留的。
 * 新代码应该使用 getSupabase() 函数获取 Supabase 客户端实例。
 * @deprecated 请使用 import { getSupabase } from '../services/supabase'
 */

import { getSupabase } from '../services/supabase';

// 为了向后兼容，导出 supabase 实例
export const supabase = getSupabase();

// 导出工具函数
export { checkSupabaseConnection } from '../utils/supabaseUtils';

// 重新导出 getSupabase 函数
export { getSupabase };

// 为了向后兼容，提供一个直接使用默认 supabase 实例的版本
export const checkConnection = async () => {
  const { checkSupabaseConnection } = await import('../utils/supabaseUtils');
  return checkSupabaseConnection(supabase);
};
