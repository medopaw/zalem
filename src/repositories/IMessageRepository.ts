import { DatabaseMessage, MessageRole, DisplayMessage, LLMHistoryMessage } from '../types/messageStructures';

/**
 * 消息存储库接口
 * 定义了与消息相关的数据访问操作
 */
export interface IMessageRepository {
  /**
   * 获取指定线程的消息
   * @param threadId 线程ID
   * @param options 获取选项
   * @returns 消息数组和可能的错误
   */
  getMessages(threadId: string, options?: {
    includeHidden?: boolean;     // 是否包含隐藏消息，默认不包含
    forLLM?: boolean;            // 是否为LLM准备消息，默认否
  }): Promise<{ messages: DatabaseMessage[], error: string | null }>;

  /**
   * 获取用于显示的消息
   * @param threadId 线程ID
   * @returns 显示消息数组和可能的错误
   */
  getDisplayMessages(threadId: string): Promise<{ messages: DisplayMessage[], error: string | null }>;

  /**
   * 获取用于发送给LLM的消息历史
   * @param threadId 线程ID
   * @returns LLM历史消息数组和可能的错误
   */
  getLLMHistoryMessages(threadId: string): Promise<{ messages: LLMHistoryMessage[], error: string | null }>;

  /**
   * 保存新消息
   * @param content 消息内容
   * @param role 消息角色
   * @param userId 用户ID
   * @param threadId 线程ID
   * @param options 保存选项
   * @returns 保存的消息
   */
  saveMessage(
    content: string | object,
    role: MessageRole,
    userId: string,
    threadId: string,
    options?: {
      isVisible?: boolean;       // 消息是否可见，默认为可见
      sendToLLM?: boolean;       // 消息是否发送给LLM，默认为是
      toolCallId?: string;       // 工具调用ID，用于tool角色
      sequence?: number;         // 消息序列号
      metadata?: Record<string, unknown>; // 消息元数据
    }
  ): Promise<DatabaseMessage>;

  /**
   * 创建欢迎消息
   * @param userId 用户ID
   * @param threadId 线程ID
   * @returns 创建的欢迎消息或null
   */
  createWelcomeMessage(userId: string, threadId: string): Promise<DatabaseMessage | null>;

  /**
   * 清除指定线程的所有消息
   * @param threadId 线程ID
   */
  clearMessages(threadId: string): Promise<void>;
}
