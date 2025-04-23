import { SupabaseClient } from '@supabase/supabase-js';
import { IThreadRepository } from './IThreadRepository';

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
    threads: Array<{ id: string, title: string | null, updated_at: string }> | null,
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
}
