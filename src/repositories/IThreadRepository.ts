import { Thread } from '../types/threads';

/**
 * 线程存储库接口
 * 定义了与聊天线程相关的数据访问操作
 */
export interface IThreadRepository {
  /**
   * 获取线程信息
   * @param threadId 线程ID
   * @returns 线程信息和可能的错误
   */
  getThread(threadId: string): Promise<{
    thread: { title: string | null, created_at: string } | null,
    error: string | null
  }>;

  /**
   * 更新线程标题
   * @param threadId 线程ID
   * @param title 新标题
   * @returns 更新后的线程信息和可能的错误
   */
  updateThreadTitle(threadId: string, title: string): Promise<{
    thread: { title: string | null } | null,
    error: string | null
  }>;

  /**
   * 获取所有线程列表
   * @returns 线程列表和可能的错误
   */
  getThreads(): Promise<{
    threads: Thread[] | null,
    error: string | null
  }>;

  /**
   * 检查数据库连接
   * @returns 是否连接成功
   */
  checkConnection(): Promise<boolean>;

  /**
   * 创建新对话并应用预生成的消息
   * @param userId 用户ID
   * @returns 新对话的ID
   */
  createThreadWithPregenerated(userId: string): Promise<string>;

  /**
   * 创建新对话
   * @returns 新对话的ID
   */
  createChatThread(): Promise<string>;
}
