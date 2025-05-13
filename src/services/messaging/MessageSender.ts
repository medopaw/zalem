/**
 * 消息发送器实现
 *
 * 负责所有消息的发送逻辑，包括发送给大模型、保存到数据库和发布事件
 */

import { IMessageSender } from '../../types/messaging/IMessageSender';
import { IMessageRepository } from '../../repositories/IMessageRepository';
import { AIService } from '../ai/AIService';
import { LLMMessage } from '../../types/messageTypes';
import { DatabaseMessage, MessageRole } from '../../types/messageStructures';
import { 
  IMessageEventBus, 
  MessageEventType, 
  ToolResultData 
} from '../../types/messaging';
import logger from '../../utils/logger';

/**
 * 消息发送器实现
 */
export class MessageSender implements IMessageSender {
  /**
   * 创建消息发送器
   * @param messageRepository 消息仓库
   * @param aiService AI服务
   * @param eventBus 事件总线
   */
  constructor(
    private messageRepository: IMessageRepository,
    private aiService: AIService,
    private eventBus: IMessageEventBus
  ) {
    logger.info('[MessageSender] Created with dependencies', undefined, 'MessageSender');
  }

  /**
   * 发送消息给大模型
   * @param threadId 线程ID
   * @param userId 用户ID
   * @returns 大模型响应
   */
  async sendToLLM(threadId: string, userId: string): Promise<LLMMessage> {
    try {
      // 1. 获取消息历史
      const { messages, error } = await this.messageRepository.getLLMHistoryMessages(threadId);

      if (error) {
        logger.error('[MessageSender] Error getting LLM history messages', [{ error }], 'MessageSender');
        throw error;
      }

      logger.info(
        `[MessageSender] Sending ${messages.length} messages to LLM for thread ${threadId}`,
        undefined,
        'MessageSender'
      );

      // 2. 发送给大模型
      const response = await this.aiService.sendMessage(messages);

      logger.info(
        '[MessageSender] Received response from LLM',
        [{ responseType: response.content ? 'text' : 'tool_calls' }],
        'MessageSender'
      );

      return response;
    } catch (error) {
      logger.error('[MessageSender] Error sending to LLM', [{ error }], 'MessageSender');

      // 发布错误事件
      this.eventBus.publish({
        type: MessageEventType.ERROR_OCCURRED,
        data: {
          threadId,
          userId,
          error: error instanceof Error ? error : new Error(String(error)),
          context: 'sendToLLM'
        }
      });

      throw error;
    }
  }

  /**
   * 发送用户消息
   * @param content 消息内容
   * @param threadId 线程ID
   * @param userId 用户ID
   * @returns 消息ID
   */
  async sendUserMessage(content: string, threadId: string, userId: string): Promise<string> {
    try {
      // 1. 保存用户消息
      const userMessage = await this.messageRepository.saveMessage(
        content,
        'user',
        userId,
        threadId
      );

      logger.info(
        `[MessageSender] Saved user message with ID ${userMessage.id}`,
        undefined,
        'MessageSender'
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

      // 3. 发送给大模型
      const assistantResponse = await this.sendToLLM(threadId, userId);

      // 4. 保存大模型响应
      await this.saveAssistantResponse(assistantResponse, threadId, userId);

      return userMessage.id;
    } catch (error) {
      logger.error('[MessageSender] Error sending user message', [{ error }], 'MessageSender');

      // 发布错误事件
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
   * @param toolResult 工具调用结果
   * @param threadId 线程ID
   * @param userId 用户ID
   * @returns 消息ID
   */
  async sendToolResult(toolResult: ToolResultData, threadId: string, userId: string): Promise<string> {
    try {
      // 1. 保存工具调用结果
      const toolResultContent = {
        type: 'tool_result',
        tool_call_id: toolResult.toolCallId,
        status: toolResult.status,
        message: toolResult.message
      };

      const toolResultMessage = await this.messageRepository.saveMessage(
        JSON.stringify(toolResultContent),
        'tool',
        userId,
        threadId,
        {
          isVisible: true,
          sendToLLM: true,
          toolCallId: toolResult.toolCallId
        }
      );

      logger.info(
        `[MessageSender] Saved tool result message with ID ${toolResultMessage.id}`,
        [{ toolCallId: toolResult.toolCallId }],
        'MessageSender'
      );

      // 2. 发布工具调用结果事件
      this.eventBus.publish({
        type: MessageEventType.TOOL_RESULT_SENT,
        data: {
          threadId,
          userId,
          toolResult,
          messageId: toolResultMessage.id
        }
      });

      // 3. 发送给大模型
      const assistantResponse = await this.sendToLLM(threadId, userId);

      // 4. 保存大模型响应
      await this.saveAssistantResponse(assistantResponse, threadId, userId);

      return toolResultMessage.id;
    } catch (error) {
      logger.error('[MessageSender] Error sending tool result', [{ error }], 'MessageSender');

      // 发布错误事件
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
   * 保存大模型响应
   * @param response 大模型响应
   * @param threadId 线程ID
   * @param userId 用户ID
   * @returns 消息ID
   */
  async saveAssistantResponse(response: LLMMessage, threadId: string, userId: string): Promise<string | undefined> {
    if (!response) {
      logger.warn('[MessageSender] Empty assistant response', undefined, 'MessageSender');
      return undefined;
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

        logger.info(
          `[MessageSender] Saved assistant text message with ID ${assistantMessage.id}`,
          undefined,
          'MessageSender'
        );

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

      // 2. 保存工具调用消息（如果有）
      if (response.tool_calls && response.tool_calls.length > 0) {
        const toolCallsContent = {
          type: 'tool_calls',
          tool_calls: response.tool_calls.map(call => ({
            id: call.id,
            name: call.function.name,
            arguments: JSON.parse(call.function.arguments)
          }))
        };

        const toolCallsMessage = await this.messageRepository.saveMessage(
          JSON.stringify(toolCallsContent),
          'assistant',
          userId,
          threadId
        );

        logger.info(
          `[MessageSender] Saved assistant tool calls message with ID ${toolCallsMessage.id}`,
          [{ toolCallsCount: response.tool_calls.length }],
          'MessageSender'
        );

        assistantMessageId = assistantMessageId || toolCallsMessage.id;

        // 处理每个工具调用
        for (const call of response.tool_calls) {
          const toolCall = {
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

      return assistantMessageId;
    } catch (error) {
      logger.error('[MessageSender] Error saving assistant response', [{ error }], 'MessageSender');

      // 发布错误事件
      this.eventBus.publish({
        type: MessageEventType.ERROR_OCCURRED,
        data: {
          threadId,
          userId,
          error: error instanceof Error ? error : new Error(String(error)),
          context: 'saveAssistantResponse'
        }
      });

      throw error;
    }
  }
}

/**
 * 创建消息发送器
 * @param messageRepository 消息仓库
 * @param aiService AI服务
 * @param eventBus 事件总线
 * @returns 消息发送器实例
 */
export function createMessageSender(
  messageRepository: IMessageRepository,
  aiService: AIService,
  eventBus: IMessageEventBus
): IMessageSender {
  return new MessageSender(messageRepository, aiService, eventBus);
}
