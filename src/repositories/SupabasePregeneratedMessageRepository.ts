import { SupabaseClient } from '@supabase/supabase-js';
import { IPregeneratedMessageRepository } from './IPregeneratedMessageRepository';

/**
 * Supabase实现的预生成消息存储库
 */
export class SupabasePregeneratedMessageRepository implements IPregeneratedMessageRepository {
  private supabase: SupabaseClient;
  
  /**
   * 构造函数
   * @param supabase Supabase客户端
   */
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }
  
  /**
   * 清除用户的未使用预生成消息
   * @param userId 用户ID
   * @returns 是否成功清除
   */
  async clearUnusedMessages(userId: string): Promise<boolean> {
    try {
      console.log(`清除用户 ${userId} 的预生成消息`);
      
      const { error } = await this.supabase
        .from('pregenerated_messages')
        .delete()
        .eq('user_id', userId)
        .eq('is_used', false);
      
      if (error) {
        console.error('清除预生成消息时出错:', error);
        return false;
      }
      
      console.log(`用户 ${userId} 的预生成消息已清除`);
      return true;
    } catch (error) {
      console.error('清除预生成消息时出错:', error);
      return false;
    }
  }
  
  /**
   * 获取用户的未使用预生成消息数量
   * @param userId 用户ID
   * @returns 未使用预生成消息数量
   */
  async getUnusedMessageCount(userId: string): Promise<number> {
    try {
      const { data, error, count } = await this.supabase
        .from('pregenerated_messages')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_used', false);
      
      if (error) {
        console.error('获取预生成消息数量时出错:', error);
        return 0;
      }
      
      return count || 0;
    } catch (error) {
      console.error('获取预生成消息数量时出错:', error);
      return 0;
    }
  }
  
  /**
   * 保存预生成消息
   * @param userId 用户ID
   * @param hiddenMessage 隐藏的用户消息
   * @param aiResponse AI响应
   * @returns 是否成功保存
   */
  async saveMessage(userId: string, hiddenMessage: string, aiResponse: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('pregenerated_messages')
        .insert([{
          user_id: userId,
          hidden_message: hiddenMessage,
          ai_response: aiResponse,
          is_used: false
        }]);
      
      if (error) {
        console.error('保存预生成消息时出错:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('保存预生成消息时出错:', error);
      return false;
    }
  }
  
  /**
   * 标记预生成消息为已使用
   * @param messageId 消息ID
   * @returns 是否成功标记
   */
  async markAsUsed(messageId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('pregenerated_messages')
        .update({
          is_used: true,
          used_at: new Date().toISOString()
        })
        .eq('id', messageId);
      
      if (error) {
        console.error('标记预生成消息为已使用时出错:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('标记预生成消息为已使用时出错:', error);
      return false;
    }
  }
}
