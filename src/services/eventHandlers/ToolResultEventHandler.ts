/**
 * 工具调用结果事件处理器
 *
 * 负责处理工具调用结果事件，将结果保存到数据库，并发送给大模型
 */

import {
  MessageEventType,
  ToolResultEventData,
  MessageEvent
} from '../../types/messaging';
import { getMessageEventBus } from '../messaging/MessageEventBus';
import { IMessageRepository } from '../../repositories/IMessageRepository';
import { AIService } from '../ai/AIService';

/**
 * 工具调用结果事件处理器
 */
export class ToolResultEventHandler {
  private messageRepository: IMessageRepository;
  private aiService: AIService;

  /**
   * 创建工具调用结果事件处理器
   */
  constructor(messageRepository: IMessageRepository, aiService: AIService) {
    this.messageRepository = messageRepository;
    this.aiService = aiService;
    this.initialize();
  }

  /**
   * 初始化事件处理器
   */
  private initialize(): void {
    const eventBus = getMessageEventBus();

    // 订阅工具调用结果事件
    eventBus.subscribe(MessageEventType.TOOL_RESULT_SENT, async (event) => {
      if (event.type === MessageEventType.TOOL_RESULT_SENT) {
        await this.handleToolResultEvent(event);
      }
    });

    console.log('[ToolResultEventHandler] Initialized');
  }

  /**
   * 处理工具调用结果事件
   */
  private async handleToolResultEvent(event: MessageEvent): Promise<void> {
    if (event.type !== MessageEventType.TOOL_RESULT_SENT) return;

    const { threadId, userId, toolResult } = event.data as ToolResultEventData;

    console.log(`[ToolResultEventHandler] Processing tool result for tool call ID: ${toolResult.toolCallId}`, toolResult);

    try {
      // 1. 保存工具调用结果消息
      // 创建工具调用结果内容
      const toolResultContent = {
        type: 'tool_result', // 使用字符串字面量，确保序列化后的值是字符串
        tool_call_id: toolResult.toolCallId,
        status: toolResult.status,
        message: toolResult.message
      };

      console.log('[ToolResultEventHandler] Creating tool result content:', toolResultContent);
      const toolResultJson = JSON.stringify(toolResultContent);
      console.log('[ToolResultEventHandler] Serialized tool result JSON:', toolResultJson);

      // 验证JSON是否有效
      try {
        const parsed = JSON.parse(toolResultJson);
        console.log('[ToolResultEventHandler] Validated JSON can be parsed back:', parsed);
      } catch (e) {
        console.error('[ToolResultEventHandler] Invalid JSON:', e);
      }

      // 保存工具调用结果消息 - 确保使用tool角色和正确的tool_call_id
      const savedResultMessage = await this.messageRepository.saveMessage(
        toolResultJson,
        'tool',
        userId,
        threadId,
        {
          isVisible: true,
          sendToLLM: true,
          toolCallId: toolResult.toolCallId
        }
      );

      console.log('[ToolResultEventHandler] Saved tool result message:', savedResultMessage);

      // 2. 获取消息历史，包括工具调用结果
      const { messages, error } = await this.messageRepository.getLLMHistoryMessages(threadId);

      if (error) {
        console.error('[ToolResultEventHandler] Error getting LLM history messages:', error);
        return;
      }

      // 3. 发送更新后的消息历史给大模型，获取新的响应
      console.log('[ToolResultEventHandler] Sending updated history to LLM with tool result');
      // 类型转换以解决类型不匹配问题
      const followupResponse = await this.aiService.sendMessage(messages as any);

      if (!followupResponse) {
        console.warn('[ToolResultEventHandler] No response from LLM after sending tool result');
        return;
      }

      // 4. 保存大模型的后续响应
      const followupMessage = await this.messageRepository.saveMessage(
        followupResponse.content || '',
        'assistant',
        userId,
        threadId
      );

      console.log('[ToolResultEventHandler] Saved followup response:', followupMessage);

      // 5. 发布助手消息事件
      this.publishAssistantMessageEvent(followupMessage.id, threadId, userId, followupResponse.content || '');
    } catch (error) {
      console.error('[ToolResultEventHandler] Error handling tool result:', error);
    }
  }

  /**
   * 发布助手消息事件
   */
  private publishAssistantMessageEvent(
    messageId: string,
    threadId: string,
    userId: string,
    content: string
  ): void {
    const eventBus = getMessageEventBus();

    eventBus.publish({
      type: MessageEventType.ASSISTANT_MESSAGE_RECEIVED,
      data: {
        threadId,
        userId,
        messageId,
        content
      }
    });
  }
}

/**
 * 创建工具调用结果事件处理器
 */
export function createToolResultEventHandler(
  messageRepository: IMessageRepository,
  aiService: AIService
): ToolResultEventHandler {
  return new ToolResultEventHandler(messageRepository, aiService);
}
