/**
 * Supabase 工具函数
 * 集中管理与 Supabase 相关的通用功能
 */
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * 检查 Supabase 连接是否正常
 * @param supabase Supabase 客户端实例
 * @param tableName 要检查的表名，默认为 'chat_threads'
 * @returns 连接是否正常
 */
export const checkSupabaseConnection = async (
  supabase: SupabaseClient,
  tableName: string = 'chat_threads'
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from(tableName)
      .select('id')
      .limit(1);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error(`Supabase connection error (${tableName}):`, error);
    return false;
  }
};
