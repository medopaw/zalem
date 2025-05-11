/**
 * Supabase 用户存储库实现
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { IUserRepository, UserInfo } from './IUserRepository';

/**
 * Supabase 用户存储库实现
 */
export class SupabaseUserRepository implements IUserRepository {
  constructor(private supabase: SupabaseClient) {}
  
  /**
   * 获取用户信息
   */
  async getUserInfo(userId: string): Promise<UserInfo | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('id, nickname, role, created_at')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('[SupabaseUserRepository] Error getting user info:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('[SupabaseUserRepository] Error getting user info:', error);
      return null;
    }
  }
  
  /**
   * 更新用户昵称
   */
  async updateNickname(userId: string, nickname: string | null): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('users')
        .update({ nickname })
        .eq('id', userId);
      
      if (error) {
        throw new Error(`Failed to update nickname: ${error.message}`);
      }
    } catch (error) {
      console.error('[SupabaseUserRepository] Error updating nickname:', error);
      throw error;
    }
  }
  
  /**
   * 更新用户角色
   */
  async updateRole(userId: string, role: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('users')
        .update({ role })
        .eq('id', userId);
      
      if (error) {
        throw new Error(`Failed to update role: ${error.message}`);
      }
    } catch (error) {
      console.error('[SupabaseUserRepository] Error updating role:', error);
      throw error;
    }
  }
}

/**
 * 创建 Supabase 用户存储库
 */
export function createSupabaseUserRepository(supabase: SupabaseClient): IUserRepository {
  return new SupabaseUserRepository(supabase);
}
