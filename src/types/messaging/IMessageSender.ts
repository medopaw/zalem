/**
 * 消息发送器接口
 *
 * 负责所有消息的发送逻辑，包括发送给大模型、保存到数据库和发布事件
 */

import { LLMMessage } from '../messageTypes';
import { DatabaseMessage } from '../messageStructures';
import { ToolResultData } from '../messaging';

/**
 * 消息发送器接口
 */
export interface IMessageSender {
  /**
   * 发送消息给大模型
   * @param threadId 线程ID
   * @param userId 用户ID
   * @returns 大模型响应
   */
  sendToLLM(threadId: string, userId: string): Promise<LLMMessage>;

  /**
   * 发送用户消息
   * @param content 消息内容
   * @param threadId 线程ID
   * @param userId 用户ID
   * @returns 消息ID
   */
  sendUserMessage(content: string, threadId: string, userId: string): Promise<string>;

  /**
   * 发送工具调用结果
   * @param toolResult 工具调用结果
   * @param threadId 线程ID
   * @param userId 用户ID
   * @returns 消息ID
   */
  sendToolResult(toolResult: ToolResultData, threadId: string, userId: string): Promise<string>;

  /**
   * 保存大模型响应
   * @param response 大模型响应
   * @param threadId 线程ID
   * @param userId 用户ID
   * @returns 消息ID
   */
  saveAssistantResponse(response: LLMMessage, threadId: string, userId: string): Promise<string | undefined>;
}
