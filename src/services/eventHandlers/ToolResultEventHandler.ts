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
import { withErrorHandling } from '../error/ErrorHandlingEnhancer';
import { getErrorReporter, ErrorLevel } from '../error/ErrorReporter';
import logger from '../../utils/logger';

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

    logger.info('[ToolResultEventHandler] Initializing event handler...', undefined, 'ToolResultEventHandler');

    // 直接在全局对象上存储处理器实例，确保它不会被垃圾回收
    const globalWindow = window as Record<string, unknown>;
    globalWindow.__toolResultEventHandler = this;

    // 创建带错误处理的事件处理函数
    const handleEvent = async (event: MessageEvent): Promise<void> => {
      if (event.type === MessageEventType.TOOL_RESULT_SENT) {
        logger.info(
          '[ToolResultEventHandler] Received TOOL_RESULT_SENT event',
          [{ eventData: event.data }],
          'ToolResultEventHandler'
        );
        await this.handleToolResultEvent(event);
      }
    };

    // 使用错误处理增强器包装事件处理函数
    const enhancedHandler = withErrorHandling(
      handleEvent,
      'ToolResultEventHandler'
    );

    // 保存处理函数引用，防止被垃圾回收
    globalWindow.__toolResultEventHandlerFn = enhancedHandler;

    // 订阅事件
    const unsubscribe = eventBus.subscribe(MessageEventType.TOOL_RESULT_SENT, enhancedHandler);

    // 保存取消订阅函数，防止被垃圾回收
    globalWindow.__toolResultEventHandlerUnsubscribe = unsubscribe;

    // 检查是否成功订阅了事件
    const eventBusWithMethods = eventBus as unknown as {
      hasListeners(eventType: MessageEventType): boolean;
      getRegisteredEventTypes(): MessageEventType[];
      getListenerCount(eventType: MessageEventType): number;
    };

    // 检查是否有监听器处理 TOOL_RESULT_SENT 事件
    const hasListener = typeof eventBusWithMethods.hasListeners === 'function'
      ? eventBusWithMethods.hasListeners(MessageEventType.TOOL_RESULT_SENT)
      : false;

    // 获取监听器数量
    const listenerCount = typeof eventBusWithMethods.getListenerCount === 'function'
      ? eventBusWithMethods.getListenerCount(MessageEventType.TOOL_RESULT_SENT)
      : -1;

    // 获取所有已注册的事件类型
    const registeredEventTypes = typeof eventBusWithMethods.getRegisteredEventTypes === 'function'
      ? eventBusWithMethods.getRegisteredEventTypes()
      : [];

    logger.info(
      '[ToolResultEventHandler] Initialization status',
      [{
        hasListener,
        listenerCount,
        registeredEventTypes
      }],
      'ToolResultEventHandler'
    );

    // 如果没有成功订阅，报告错误
    if (!hasListener) {
      const errorMessage = '[ToolResultEventHandler] Failed to subscribe to TOOL_RESULT_SENT event';
      logger.error(errorMessage, undefined, 'ToolResultEventHandler');

      // 报告错误
      getErrorReporter().reportToUI({
        title: '事件处理器初始化失败',
        message: '工具调用结果处理器无法订阅事件，可能导致工具调用结果无法正确处理',
        level: ErrorLevel.ERROR,
        context: 'ToolResultEventHandler'
      });
    }

    // 添加全局监听器作为备份
    const globalHandler = async (event: MessageEvent): Promise<void> => {
      if (event.type === MessageEventType.TOOL_RESULT_SENT) {
        logger.info(
          '[ToolResultEventHandler] Received TOOL_RESULT_SENT event via global listener',
          [{ eventData: event.data }],
          'ToolResultEventHandler'
        );
        await this.handleToolResultEvent(event);
      }
    };

    // 使用错误处理增强器包装全局事件处理函数
    const enhancedGlobalHandler = withErrorHandling(
      globalHandler,
      'ToolResultEventHandler.global'
    );

    // 订阅全局事件
    const globalUnsubscribe = eventBus.subscribeAll(enhancedGlobalHandler);

    // 保存全局取消订阅函数
    globalWindow.__toolResultEventHandlerGlobalUnsubscribe = globalUnsubscribe;

    logger.info('[ToolResultEventHandler] Initialization complete with backup global listener', undefined, 'ToolResultEventHandler');

    // 添加一个测试函数，可以在控制台手动触发
    globalWindow.testToolResultEvent = (threadId: string, userId: string, toolCallId: string) => {
      logger.info('[ToolResultEventHandler] Manually triggering tool result event', undefined, 'ToolResultEventHandler');
      eventBus.publish({
        type: MessageEventType.TOOL_RESULT_SENT,
        data: {
          threadId,
          userId,
          toolResult: {
            toolCallId,
            status: 'success',
            result: { test: true },
            message: '测试工具调用结果'
          },
          messageId: 'test-' + Date.now()
        }
      });
    };
  }

  /**
   * 处理工具调用结果事件
   */
  private async handleToolResultEvent(event: MessageEvent): Promise<void> {
    if (event.type !== MessageEventType.TOOL_RESULT_SENT) return;

    const { threadId, userId, toolResult } = event.data as ToolResultEventData;

    logger.info(
      `[ToolResultEventHandler] Processing tool result for tool call ID: ${toolResult.toolCallId}`,
      [{ toolResult }],
      'ToolResultEventHandler'
    );

    try {
      // 注意：我们不再保存工具调用结果消息，因为它已经在NicknameHandler中保存了
      // 直接获取消息历史，包括工具调用结果
      console.log('[ToolResultEventHandler] Getting LLM history messages for thread:', threadId);

      // 先获取原始数据库消息，用于调试
      const { messages: dbMessages } = await this.messageRepository.getMessages(threadId, {
        includeHidden: true,
        forLLM: true
      });

      console.log('[ToolResultEventHandler] Raw DB messages:', dbMessages.map(msg => ({
        id: msg.id,
        role: msg.role,
        tool_call_id: msg.tool_call_id,
        content_preview: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : ''),
        send_to_llm: msg.send_to_llm
      })));

      // 检查是否有工具调用结果消息
      const toolResultMessage = dbMessages.find(msg =>
        msg.role === 'tool' &&
        msg.tool_call_id === toolResult.toolCallId
      );

      if (toolResultMessage) {
        console.log('[ToolResultEventHandler] Found tool result message in DB:', {
          id: toolResultMessage.id,
          role: toolResultMessage.role,
          tool_call_id: toolResultMessage.tool_call_id,
          content: toolResultMessage.content,
          send_to_llm: toolResultMessage.send_to_llm
        });
      } else {
        console.error('[ToolResultEventHandler] Tool result message not found in DB messages!');

        // 如果没有找到工具调用结果消息，手动保存一个
        console.log('[ToolResultEventHandler] Saving tool result message manually');

        const toolResultContent = {
          type: 'tool_result',
          tool_call_id: toolResult.toolCallId,
          status: toolResult.status,
          message: toolResult.message
        };

        const toolResultJson = JSON.stringify(toolResultContent);

        await this.messageRepository.saveMessage(
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

        console.log('[ToolResultEventHandler] Manually saved tool result message');
      }

      // 获取转换后的LLM历史消息
      const { messages, error } = await this.messageRepository.getLLMHistoryMessages(threadId);

      if (error) {
        console.error('[ToolResultEventHandler] Error getting LLM history messages:', error);
        return;
      }

      // 检查转换后的消息中是否有工具调用结果消息
      const llmToolResultMessage = messages.find(msg =>
        msg.role === 'tool' &&
        msg.tool_call_id === toolResult.toolCallId
      );

      if (llmToolResultMessage) {
        console.log('[ToolResultEventHandler] Found tool result message in LLM history:', llmToolResultMessage);
      } else {
        console.error('[ToolResultEventHandler] Tool result message not found in LLM history messages!');
      }

      // 3. 发送更新后的消息历史给大模型，获取新的响应
      console.log('[ToolResultEventHandler] Sending updated history to LLM with tool result');

      // 打印每条消息的详细信息，特别关注工具调用结果消息
      messages.forEach((msg, index) => {
        console.log(`[ToolResultEventHandler] Message ${index + 1}:`, {
          role: msg.role,
          content: msg.content,
          tool_call_id: msg.tool_call_id
        });
      });

      // 确保消息历史中包含工具调用结果
      const hasToolResult = messages.some(msg =>
        msg.role === 'tool' && msg.tool_call_id === toolResult.toolCallId
      );

      if (!hasToolResult) {
        console.error('[ToolResultEventHandler] Tool result message not found in history! Adding manually...');

        // 手动添加工具调用结果消息
        const manualToolResultMessage = {
          role: 'tool' as const,
          content: toolResult.message,
          tool_call_id: toolResult.toolCallId
        };

        messages.push(manualToolResultMessage);

        console.log('[ToolResultEventHandler] Manually added tool result message to history:', manualToolResultMessage);
      }

      // 再次检查消息历史中是否包含工具调用结果
      const hasToolResultAfterFix = messages.some(msg =>
        msg.role === 'tool' && msg.tool_call_id === toolResult.toolCallId
      );

      if (!hasToolResultAfterFix) {
        console.error('[ToolResultEventHandler] CRITICAL ERROR: Still no tool result message in history after fix!');
        return;
      }

      console.log('[ToolResultEventHandler] Final messages to send to LLM:', JSON.stringify(messages, null, 2));

      // 发送消息给大模型
      try {
        // 类型转换以解决类型不匹配问题
        const followupResponse = await this.aiService.sendMessage(messages as any);

        console.log('[ToolResultEventHandler] Received response from LLM:', followupResponse);

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
      } catch (aiError) {
        console.error('[ToolResultEventHandler] Error sending message to AI service:', aiError);
      }
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

    logger.info(
      '[ToolResultEventHandler] Publishing assistant message event',
      [{
        messageId,
        threadId,
        contentPreview: content.substring(0, 100) + (content.length > 100 ? '...' : '')
      }],
      'ToolResultEventHandler'
    );

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
