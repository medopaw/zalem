import { SupabaseClient } from '@supabase/supabase-js';
import { ChatMessage } from '../types/chat';
import { IMessageRepository } from './IMessageRepository';

/**
 * Supabase 实现的消息存储库
 */
export class SupabaseMessageRepository implements IMessageRepository {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * 获取指定线程的消息
   * @param threadId 线程ID
   * @param includeHidden 是否包含隐藏消息，默认不包含
   */
  async getMessages(threadId: string, includeHidden: boolean = false): Promise<{ messages: ChatMessage[], error: string | null }> {
    try {
      // 创建查询构建器
      let query = this.supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId);

      // 如果不包含隐藏消息，添加可见性过滤条件
      if (!includeHidden) {
        query = query.eq('is_visible', true);
      }

      // 执行查询
      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) {
        return { messages: [], error: `Failed to load messages.\nError: ${error}` };
      }

      return { messages: data || [], error: null };
    } catch (error) {
      console.error('Error loading messages:', error);
      return { messages: [], error: 'Failed to load messages' };
    }
  }

  /**
   * 保存新消息
   * @param content 消息内容
   * @param role 消息角色
   * @param userId 用户ID
   * @param threadId 线程ID
   * @param isVisible 消息是否可见，默认为可见
   * @returns 保存的消息
   */
  async saveMessage(
    content: string,
    role: 'user' | 'assistant',
    userId: string,
    threadId: string,
    isVisible: boolean = true
  ): Promise<ChatMessage> {
    const { data, error } = await this.supabase
      .from('chat_messages')
      .insert([{
        content,
        role,
        user_id: userId,
        thread_id: threadId,
        is_visible: isVisible
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * 创建欢迎消息
   */
  async createWelcomeMessage(userId: string, threadId: string): Promise<ChatMessage | null> {
    try {
      const welcomeMessage = "欢迎来到新对话！我能为您提供什么帮助？";
      console.log('Creating welcome message for thread:', threadId);

      const { data, error } = await this.supabase
        .from('chat_messages')
        .insert([{
          content: welcomeMessage,
          role: 'assistant',
          user_id: userId,
          thread_id: threadId
        }])
        .select()
        .single();

      if (error) {
        console.error('Error saving welcome message:', error);
        return null;
      }

      console.log('Welcome message created successfully:', data);
      return data;
    } catch (error) {
      console.error('Error creating welcome message:', error);
      return null;
    }
  }

  /**
   * 清除指定线程的所有消息
   */
  async clearMessages(threadId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('chat_messages')
        .delete()
        .eq('thread_id', threadId);

      if (error) throw error;
    } catch (error) {
      console.error('Error clearing messages:', error);
      throw new Error('Failed to clear messages');
    }
  }
}
