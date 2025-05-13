/**
 * 工具调用事件处理器
 *
 * 负责处理工具调用事件，将工具调用分发给相应的处理器
 */

import {
  MessageEventType,
  ToolCallEventData,
  ToolResultData,
  MessageEvent
} from '../../types/messaging';
import { getMessageEventBus } from '../messaging/MessageEventBus';
import { getToolCallProcessorRegistry } from '../messaging/ToolCallProcessorRegistry';
import { IMessageRepository } from '../../repositories/IMessageRepository';
import { withErrorHandling } from '../error/ErrorHandlingEnhancer';
import logger from '../../utils/logger';

/**
 * 工具调用事件处理器
 */
export class ToolCallEventHandler {
  private messageRepository: IMessageRepository;

  /**
   * 创建工具调用事件处理器
   */
  constructor(messageRepository: IMessageRepository) {
    this.messageRepository = messageRepository;
    this.initialize();
  }

  /**
   * 初始化事件处理器
   */
  private initialize(): void {
    const eventBus = getMessageEventBus();

    // 创建带错误处理的事件处理函数
    const handleEvent = async (event: MessageEvent): Promise<void> => {
      if (event.type === MessageEventType.TOOL_CALL_RECEIVED) {
        await this.handleToolCallEvent(event.data as ToolCallEventData);
      }
    };

    // 使用错误处理增强器包装事件处理函数
    const enhancedHandler = withErrorHandling(
      handleEvent,
      'ToolCallEventHandler'
    );

    // 订阅工具调用事件
    eventBus.subscribe(MessageEventType.TOOL_CALL_RECEIVED, enhancedHandler);

    logger.info('[ToolCallEventHandler] Initialized with error handling', undefined, 'ToolCallEventHandler');
  }

  /**
   * 处理工具调用事件
   */
  private async handleToolCallEvent(data: ToolCallEventData): Promise<void> {
    const { toolCall, threadId, userId } = data;

    console.log(`[ToolCallEventHandler] Processing tool call: ${toolCall.name}`, toolCall);

    try {
      // 获取工具处理器
      const registry = getToolCallProcessorRegistry();
      const processor = registry.getProcessor(toolCall.name);

      if (!processor) {
        console.warn(`[ToolCallEventHandler] No processor found for tool: ${toolCall.name}`);

        // 发布工具调用结果事件（错误）
        this.publishToolResultEvent({
          toolCallId: toolCall.id,
          status: 'error',
          result: null,
          message: `未找到工具处理器: ${toolCall.name}`
        }, threadId, userId);

        return;
      }

      // 处理工具调用
      const result = await processor.processToolCall(toolCall, threadId, userId);

      // 发布工具调用结果事件
      this.publishToolResultEvent(result, threadId, userId);
    } catch (error) {
      console.error(`[ToolCallEventHandler] Error processing tool call ${toolCall.name}:`, error);

      // 发布工具调用结果事件（错误）
      this.publishToolResultEvent({
        toolCallId: toolCall.id,
        status: 'error',
        result: null,
        message: `工具执行错误: ${error instanceof Error ? error.message : String(error)}`
      }, threadId, userId);
    }
  }

  /**
   * 发布工具调用结果事件
   */
  private publishToolResultEvent(
    toolResult: ToolResultData,
    threadId: string,
    userId: string
  ): void {
    const eventBus = getMessageEventBus();

    // 使用日志系统记录事件
    logger.info(
      '[ToolCallEventHandler] Publishing tool result event',
      [{
        toolCallId: toolResult.toolCallId,
        status: toolResult.status,
        message: toolResult.message
      }],
      'ToolCallEventHandler'
    );

    // 发布事件
    eventBus.publish({
      type: MessageEventType.TOOL_RESULT_SENT,
      data: {
        threadId,
        userId,
        toolResult,
        messageId: '' // 消息ID将在保存后设置
      }
    });
  }
}

/**
 * 创建工具调用事件处理器
 */
export function createToolCallEventHandler(messageRepository: IMessageRepository): ToolCallEventHandler {
  return new ToolCallEventHandler(messageRepository);
}
