import { SupabaseClient } from '@supabase/supabase-js';
import { IThreadRepository } from './IThreadRepository';
import { Thread } from '../types/threads';

/**
 * Supabase 实现的线程存储库
 */
export class SupabaseThreadRepository implements IThreadRepository {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * 获取线程信息
   */
  async getThread(threadId: string): Promise<{
    thread: { title: string | null, created_at: string } | null,
    error: string | null
  }> {
    try {
      const { data, error } = await this.supabase
        .from('chat_threads')
        .select('created_at, title')
        .eq('id', threadId)
        .single();

      if (error) {
        return {
          thread: null,
          error: `Failed to load thread ${threadId}.\nError: ${error}`
        };
      }

      return { thread: data, error: null };
    } catch (error) {
      console.error('Error loading thread:', error);
      return {
        thread: null,
        error: 'Failed to load thread'
      };
    }
  }

  /**
   * 更新线程标题
   */
  async updateThreadTitle(threadId: string, title: string): Promise<{
    thread: { title: string | null } | null,
    error: string | null
  }> {
    try {
      const { data, error } = await this.supabase
        .from('chat_threads')
        .update({ title })
        .eq('id', threadId)
        .select()
        .single();

      if (error) {
        return {
          thread: null,
          error: `Failed to update thread title.\nError: ${error}`
        };
      }

      return { thread: data, error: null };
    } catch (error) {
      console.error('Error updating thread title:', error);
      return {
        thread: null,
        error: 'Failed to update thread title'
      };
    }
  }

  /**
   * 获取所有线程列表
   */
  async getThreads(): Promise<{
    threads: Thread[] | null,
    error: string | null
  }> {
    try {
      const { data, error } = await this.supabase
        .from('chat_threads')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        return {
          threads: null,
          error: `Failed to load threads.\nError: ${error}`
        };
      }

      return { threads: data, error: null };
    } catch (error) {
      console.error('Error loading threads:', error);
      return {
        threads: null,
        error: 'Failed to load threads'
      };
    }
  }

  /**
   * 检查数据库连接
   */
  async checkConnection(): Promise<boolean> {
    const { checkSupabaseConnection } = await import('../utils/supabaseUtils');
    return checkSupabaseConnection(this.supabase, 'chat_threads');
  }

  /**
   * 创建新对话并应用预生成的消息
   * @param userId 用户ID
   * @returns 新对话的ID
   */
  async createThreadWithPregenerated(userId: string): Promise<string> {
    try {
      console.log(`Creating new thread with pregenerated messages for user ${userId}`);

      // 尝试使用存储过程创建新对话
      try {
        const { data, error } = await this.supabase.rpc('create_thread_with_pregenerated', {
          p_user_id: userId
        });

        if (error) {
          console.error('Error creating thread with pregenerated messages using RPC:', error);
          // 如果存储过程失败，则使用手动方式创建
          throw error;
        }

        console.log(`Thread created with ID: ${data}`);
        return data;
      } catch {
        // 如果存储过程失败，则使用手动方式创建
        console.log('Falling back to manual thread creation with pregenerated messages');
        return await this.manualCreateThreadWithPregenerated(userId);
      }
    } catch (error) {
      console.error('Failed to create thread with pregenerated messages:', error);
      throw new Error('Failed to create new thread');
    }
  }

  /**
   * 手动创建新对话并应用预生成的消息
   * 这是当存储过程失败时的备用方案
   * @param userId 用户ID
   * @returns 新对话的ID
   */
  private async manualCreateThreadWithPregenerated(userId: string): Promise<string> {
    try {
      // 1. 归档当前活跃对话
      const { data: activeThreads } = await this.supabase
        .from('chat_threads')
        .select('id')
        .eq('created_by', userId)
        .eq('is_archived', false);

      if (activeThreads && activeThreads.length > 0) {
        const oldThreadId = activeThreads[0].id;
        await this.supabase
          .from('chat_threads')
          .update({ is_archived: true })
          .eq('id', oldThreadId);
      }

      // 2. 创建新对话
      const { data: newThread, error: threadError } = await this.supabase
        .from('chat_threads')
        .insert([{
          title: '新对话',
          created_by: userId,
          is_archived: false
        }])
        .select()
        .single();

      if (threadError || !newThread) {
        throw new Error(`Failed to create new thread: ${threadError?.message}`);
      }

      const newThreadId = newThread.id;

      // 3. 获取未使用的预生成消息
      const { data: pregeneratedMessages } = await this.supabase
        .from('pregenerated_messages')
        .select('id, hidden_message, ai_response')
        .eq('user_id', userId)
        .eq('is_used', false)
        .order('created_at', { ascending: true })
        .limit(1);

      if (pregeneratedMessages && pregeneratedMessages.length > 0) {
        const pregenerated = pregeneratedMessages[0];

        // 4. 插入隐藏的用户消息，并设置 send_to_llm = true
        await this.supabase
          .from('chat_messages')
          .insert([{
            content: pregenerated.hidden_message,
            role: 'user',
            user_id: userId,
            thread_id: newThreadId,
            is_visible: false,
            send_to_llm: true // 确保隐藏消息会发送给大模型
          }]);

        // 5. 插入AI响应
        await this.supabase
          .from('chat_messages')
          .insert([{
            content: pregenerated.ai_response,
            role: 'assistant',
            user_id: userId,
            thread_id: newThreadId,
            is_visible: true,
            send_to_llm: true
          }]);

        // 6. 标记预生成消息为已使用
        await this.supabase
          .from('pregenerated_messages')
          .update({
            is_used: true,
            used_at: new Date().toISOString()
          })
          .eq('id', pregenerated.id);
      }

      return newThreadId;
    } catch (error) {
      console.error('Error in manual thread creation:', error);
      throw new Error('Failed to manually create thread with pregenerated messages');
    }
  }

  /**
   * 创建新对话
   * @returns 新对话的ID
   */
  async createChatThread(): Promise<string> {
    try {
      console.log('Creating new thread');

      const { data, error } = await this.supabase.rpc('create_chat_thread');

      if (error) {
        console.error('Error creating thread:', error);
        throw error;
      }

      console.log(`Thread created with ID: ${data}`);
      return data;
    } catch (error) {
      console.error('Failed to create thread:', error);
      throw new Error('Failed to create new thread');
    }
  }
}
