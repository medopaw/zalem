/**
 * 消息服务实现
 *
 * 负责消息的发送、接收和处理
 */

import {
  IMessageService,
  MessageEventType,
  ToolResultData,
  ToolCallData
} from '../../types/messaging';
import { IThreadRepository } from '../../repositories/IThreadRepository';
import { getMessageEventBus } from './MessageEventBus';
import { IMessageRepository } from '../../repositories/IMessageRepository';
import { DatabaseMessage, MessageRole } from '../../types/messageStructures';
import { AIService, getAIService } from '../ai/AIService';


/**
 * 消息服务实现
 */
export class MessageService implements IMessageService {
  private eventBus = getMessageEventBus();
  private aiService: AIService;

  constructor(
    private messageRepository: IMessageRepository,
    private threadRepository: IThreadRepository,
    aiService?: AIService
  ) {
    this.aiService = aiService || getAIService();
  }

  /**
   * 发送用户消息
   * @returns 消息ID
   */
  async sendUserMessage(
    content: string,
    threadId: string,
    userId: string
  ): Promise<string> {
    try {
      // 1. 保存用户消息
      const userMessage = await this.messageRepository.saveMessage(
        content,
        'user',
        userId,
        threadId
      );

      // 2. 发布用户消息事件
      this.eventBus.publish({
        type: MessageEventType.USER_MESSAGE_SENT,
        data: {
          threadId,
          userId,
          content,
          messageId: userMessage.id
        }
      });

      // 3. 获取消息历史
      const { messages } = await this.messageRepository.getLLMHistoryMessages(threadId);

      // 4. 发送消息给大模型
      const assistantResponse = await this.aiService.sendMessage(messages);

      // 5. 处理大模型响应
      await this.handleAssistantResponse(assistantResponse, threadId, userId);

      return userMessage.id;
    } catch (error) {
      console.error('[MessageService] Error sending user message:', error);
      this.eventBus.publish({
        type: MessageEventType.ERROR_OCCURRED,
        data: {
          threadId,
          userId,
          error: error instanceof Error ? error : new Error(String(error)),
          context: 'sendUserMessage'
        }
      });
      throw error;
    }
  }

  /**
   * 发送工具调用结果
   * @returns 消息ID
   */
  async sendToolResult(
    toolResult: ToolResultData,
    threadId: string,
    userId: string
  ): Promise<string> {
    try {
      // 发布工具调用结果事件，让 ToolResultEventHandler 处理
      this.eventBus.publish({
        type: MessageEventType.TOOL_RESULT_SENT,
        data: {
          threadId,
          userId,
          toolResult,
          messageId: '' // 消息ID将在保存后设置
        }
      });

      // 返回一个临时ID，实际消息ID将由事件处理器设置
      return `temp-${Date.now()}`;
    } catch (error) {
      console.error('[MessageService] Error sending tool result:', error);
      this.eventBus.publish({
        type: MessageEventType.ERROR_OCCURRED,
        data: {
          threadId,
          userId,
          error: error instanceof Error ? error : new Error(String(error)),
          context: 'sendToolResult'
        }
      });
      throw error;
    }
  }

  /**
   * 获取线程的消息
   */
  async getMessages(
    threadId: string,
    options?: { includeHidden?: boolean; forLLM?: boolean; }
  ): Promise<DatabaseMessage[]> {
    const { messages, error } = await this.messageRepository.getMessages(threadId, options);
    if (error) {
      throw new Error(`Failed to get messages: ${error}`);
    }
    return messages;
  }

  /**
   * 获取线程信息
   */
  async getThread(threadId: string): Promise<{ thread: any | null, error: string | null }> {
    return this.threadRepository.getThread(threadId);
  }

  /**
   * 获取用户的所有线程
   */
  async getThreads(): Promise<{ threads: any[], error: string | null }> {
    return this.threadRepository.getThreads();
  }

  /**
   * 更新线程标题
   */
  async updateThreadTitle(threadId: string, title: string): Promise<{ thread: any | null, error: string | null }> {
    return this.threadRepository.updateThreadTitle(threadId, title);
  }

  /**
   * 处理大模型响应
   */
  private async handleAssistantResponse(
    response: any,
    threadId: string,
    userId: string
  ): Promise<void> {
    if (!response) {
      console.warn('[MessageService] Empty assistant response');
      return;
    }

    try {
      // 1. 保存助手消息内容（如果有）
      let assistantMessageId: string | undefined;

      if (response.content) {
        const assistantMessage = await this.messageRepository.saveMessage(
          response.content,
          'assistant',
          userId,
          threadId
        );

        assistantMessageId = assistantMessage.id;

        // 发布助手消息事件
        this.eventBus.publish({
          type: MessageEventType.ASSISTANT_MESSAGE_RECEIVED,
          data: {
            threadId,
            userId,
            content: response.content,
            messageId: assistantMessage.id
          }
        });
      }

      // 2. 处理工具调用（如果有）
      if (response.tool_calls && response.tool_calls.length > 0) {
        // 保存工具调用消息
        const toolCallsContent = {
          type: 'tool_calls',
          calls: response.tool_calls.map((call: any) => ({
            id: call.id,
            name: call.function.name,
            parameters: JSON.parse(call.function.arguments)
          }))
        };

        const toolCallsMessage = await this.messageRepository.saveMessage(
          toolCallsContent,
          'assistant',
          userId,
          threadId
        );

        assistantMessageId = assistantMessageId || toolCallsMessage.id;

        // 处理每个工具调用
        for (const call of response.tool_calls) {
          const toolCall: ToolCallData = {
            id: call.id,
            name: call.function.name,
            arguments: JSON.parse(call.function.arguments)
          };

          // 发布工具调用事件
          this.eventBus.publish({
            type: MessageEventType.TOOL_CALL_RECEIVED,
            data: {
              threadId,
              userId,
              toolCall,
              messageId: toolCallsMessage.id
            }
          });

          // 工具调用的处理已经移至 ToolCallEventHandler
          // 这里只负责发布事件，不再直接处理工具调用
        }
      }

      // 3. 发布消息更新事件
      const { messages } = await this.messageRepository.getMessages(threadId);
      this.eventBus.publish({
        type: MessageEventType.MESSAGES_UPDATED,
        data: {
          threadId,
          userId,
          messages
        }
      });

    } catch (error) {
      console.error('[MessageService] Error handling assistant response:', error);
      this.eventBus.publish({
        type: MessageEventType.ERROR_OCCURRED,
        data: {
          threadId,
          userId,
          error: error instanceof Error ? error : new Error(String(error)),
          context: 'handleAssistantResponse'
        }
      });
    }
  }


}

// 导出工厂函数
export function createMessageService(
  messageRepository: IMessageRepository,
  threadRepository: IThreadRepository,
  aiService?: AIService
): IMessageService {
  return new MessageService(messageRepository, threadRepository, aiService);
}
