import { ChatMessage } from '../types/chat';

/**
 * 消息存储库接口
 * 定义了与消息相关的数据访问操作
 */
export interface IMessageRepository {
  /**
   * 获取指定线程的所有消息
   * @param threadId 线程ID
   * @returns 消息数组和可能的错误
   */
  getMessages(threadId: string): Promise<{ messages: ChatMessage[], error: string | null }>;
  
  /**
   * 保存新消息
   * @param content 消息内容
   * @param role 消息角色（用户或助手）
   * @param userId 用户ID
   * @param threadId 线程ID
   * @returns 保存的消息
   */
  saveMessage(
    content: string, 
    role: 'user' | 'assistant', 
    userId: string, 
    threadId: string
  ): Promise<ChatMessage>;
  
  /**
   * 创建欢迎消息
   * @param userId 用户ID
   * @param threadId 线程ID
   * @returns 创建的欢迎消息或null
   */
  createWelcomeMessage(userId: string, threadId: string): Promise<ChatMessage | null>;
  
  /**
   * 清除指定线程的所有消息
   * @param threadId 线程ID
   */
  clearMessages(threadId: string): Promise<void>;
}
