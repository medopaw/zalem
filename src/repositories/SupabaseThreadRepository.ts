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
      
      // 使用存储过程创建新对话
      const { data, error } = await this.supabase.rpc('create_thread_with_pregenerated', {
        p_user_id: userId
      });
      
      if (error) {
        console.error('Error creating thread with pregenerated messages:', error);
        throw error;
      }
      
      console.log(`Thread created with ID: ${data}`);
      return data;
    } catch (error) {
      console.error('Failed to create thread with pregenerated messages:', error);
      throw new Error('Failed to create new thread');
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
