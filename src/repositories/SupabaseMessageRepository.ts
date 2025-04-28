import { SupabaseClient } from '@supabase/supabase-js';
import { IMessageRepository } from './IMessageRepository';
import {
  DatabaseMessage,
  DisplayMessage,
  LLMHistoryMessage,
  MessageRole,
  toDisplayMessage,
  toLLMHistoryMessage
} from '../types/messageStructures';

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
   * @param options 获取选项
   */
  async getMessages(threadId: string, options?: {
    includeHidden?: boolean;
    forLLM?: boolean;
  }): Promise<{ messages: DatabaseMessage[], error: string | null }> {
    try {
      // 默认选项
      const {
        includeHidden = false,
        forLLM = false
      } = options || {};

      // 创建查询构建器
      let query = this.supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId);

      // 如果不包含隐藏消息，添加可见性过滤条件
      if (!includeHidden) {
        query = query.eq('is_visible', true);
      }

      // 如果是为LLM准备消息，只包含需要发送给LLM的消息
      if (forLLM) {
        query = query.eq('send_to_llm', true);
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
   * 获取用于显示的消息
   * @param threadId 线程ID
   */
  async getDisplayMessages(threadId: string): Promise<{ messages: DisplayMessage[], error: string | null }> {
    try {
      // 获取可见消息
      const { messages, error } = await this.getMessages(threadId, { includeHidden: false });

      if (error) {
        return { messages: [], error };
      }

      // 转换为显示消息
      const displayMessages = messages.map(toDisplayMessage);

      return { messages: displayMessages, error: null };
    } catch (error) {
      console.error('Error getting display messages:', error);
      return { messages: [], error: 'Failed to get display messages' };
    }
  }

  /**
   * 获取用于发送给LLM的消息历史
   * @param threadId 线程ID
   */
  async getLLMHistoryMessages(threadId: string): Promise<{ messages: LLMHistoryMessage[], error: string | null }> {
    try {
      // 获取需要发送给LLM的消息
      const { messages, error } = await this.getMessages(threadId, {
        includeHidden: true,
        forLLM: true
      });

      if (error) {
        return { messages: [], error };
      }

      // 转换为LLM历史消息
      const llmMessages = messages.map(toLLMHistoryMessage);

      return { messages: llmMessages, error: null };
    } catch (error) {
      console.error('Error getting LLM history messages:', error);
      return { messages: [], error: 'Failed to get LLM history messages' };
    }
  }

  /**
   * 保存新消息
   * @param content 消息内容
   * @param role 消息角色
   * @param userId 用户ID
   * @param threadId 线程ID
   * @param options 保存选项
   */
  async saveMessage(
    content: string | object,
    role: MessageRole,
    userId: string,
    threadId: string,
    options?: {
      isVisible?: boolean;
      sendToLLM?: boolean;
      toolCallId?: string;
      sequence?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<DatabaseMessage> {
    // 默认选项
    const {
      isVisible = true,
      sendToLLM = true,
      toolCallId,
      sequence,
      metadata
    } = options || {};

    // 如果内容是对象，转换为JSON字符串
    const contentStr = typeof content === 'object' ? JSON.stringify(content) : content;

    // 准备插入数据
    const insertData: Record<string, unknown> = {
      content: contentStr,
      role,
      user_id: userId,
      thread_id: threadId,
      is_visible: isVisible,
      send_to_llm: sendToLLM
    };

    // 添加可选字段
    if (toolCallId) insertData.tool_call_id = toolCallId;
    if (sequence !== undefined) insertData.sequence = sequence;
    if (metadata) insertData.metadata = metadata;

    // 插入数据
    const { data, error } = await this.supabase
      .from('chat_messages')
      .insert([insertData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * 创建欢迎消息
   * @param userId 用户ID
   * @param threadId 线程ID
   */
  async createWelcomeMessage(userId: string, threadId: string): Promise<DatabaseMessage | null> {
    try {
      const welcomeMessage = "欢迎来到新对话！我能为您提供什么帮助？";
      console.log('Creating welcome message for thread:', threadId);

      return await this.saveMessage(
        welcomeMessage,
        'assistant',
        userId,
        threadId,
        { isVisible: true, sendToLLM: true }
      );
    } catch (error) {
      console.error('Error creating welcome message:', error);
      return null;
    }
  }

  /**
   * 清除指定线程的所有消息
   * @param threadId 线程ID
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
