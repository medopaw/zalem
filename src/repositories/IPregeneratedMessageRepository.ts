/**
 * 预生成消息存储库接口
 * 定义了与预生成消息相关的操作
 */
export interface IPregeneratedMessageRepository {
  /**
   * 清除用户的未使用预生成消息
   * @param userId 用户ID
   * @returns 是否成功清除
   */
  clearUnusedMessages(userId: string): Promise<boolean>;
  
  /**
   * 获取用户的未使用预生成消息数量
   * @param userId 用户ID
   * @returns 未使用预生成消息数量
   */
  getUnusedMessageCount(userId: string): Promise<number>;
  
  /**
   * 保存预生成消息
   * @param userId 用户ID
   * @param hiddenMessage 隐藏的用户消息
   * @param aiResponse AI响应
   * @returns 是否成功保存
   */
  saveMessage(userId: string, hiddenMessage: string, aiResponse: string): Promise<boolean>;
  
  /**
   * 标记预生成消息为已使用
   * @param messageId 消息ID
   * @returns 是否成功标记
   */
  markAsUsed(messageId: string): Promise<boolean>;
}
