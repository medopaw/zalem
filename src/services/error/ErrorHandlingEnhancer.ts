/**
 * 错误处理增强器
 *
 * 为事件处理器添加统一的错误处理逻辑
 */

import { MessageEvent, MessageEventType } from '../../types/messaging';
import { getErrorReporter, ErrorLevel } from './ErrorReporter';
import logger from '../../utils/logger';

/**
 * 事件处理函数类型
 */
export type EventHandlerFunction = (event: MessageEvent) => Promise<void>;

/**
 * 事件名称映射
 * 将事件类型映射为用户友好的名称
 */
const EVENT_NAMES: Record<MessageEventType, string> = {
  [MessageEventType.USER_MESSAGE_SENT]: '用户消息',
  [MessageEventType.ASSISTANT_MESSAGE_RECEIVED]: '助手消息',
  [MessageEventType.TOOL_CALL_RECEIVED]: '工具调用',
  [MessageEventType.TOOL_RESULT_SENT]: '工具调用结果',
  [MessageEventType.MESSAGES_UPDATED]: '消息更新',
  [MessageEventType.ERROR_OCCURRED]: '错误'
};

/**
 * 获取事件的用户友好名称
 * @param eventType 事件类型
 * @returns 用户友好的事件名称
 */
export function getEventName(eventType: MessageEventType): string {
  return EVENT_NAMES[eventType] || '未知操作';
}

/**
 * 增强事件处理函数，添加错误处理逻辑
 * @param handler 原始事件处理函数
 * @param handlerName 处理器名称，用于日志和错误报告
 * @returns 增强后的事件处理函数
 */
export function withErrorHandling(
  handler: EventHandlerFunction,
  handlerName: string
): EventHandlerFunction {
  return async (event: MessageEvent): Promise<void> => {
    try {
      // 记录事件处理开始
      logger.debug(
        `[${handlerName}] 开始处理事件: ${event.type}`,
        [{ eventData: event.data }],
        handlerName
      );

      // 调用原始处理函数
      await handler(event);

      // 记录事件处理完成
      logger.debug(
        `[${handlerName}] 事件处理完成: ${event.type}`,
        undefined,
        handlerName
      );
    } catch (error) {
      // 记录错误日志
      logger.error(
        `[${handlerName}] 处理事件 ${event.type} 时出错:`,
        [error],
        handlerName
      );

      // 获取错误报告服务
      const errorReporter = getErrorReporter();

      // 向用户报告错误
      errorReporter.reportToUI({
        title: '操作失败',
        message: `处理${getEventName(event.type)}时出错: ${error instanceof Error ? error.message : String(error)}`,
        level: ErrorLevel.ERROR,
        details: error instanceof Error ? error.stack : undefined,
        context: handlerName,
        actionType: event.type
      });

      // 重新抛出错误，确保调用者知道发生了错误
      throw error;
    }
  };
}

/**
 * 创建可重试的事件处理函数
 * @deprecated 不再支持重试功能，请使用 withErrorHandling 替代
 * @param handler 原始事件处理函数
 * @param handlerName 处理器名称，用于日志和错误报告
 * @returns 增强后的事件处理函数
 */
export function withRetryableErrorHandling(
  handler: EventHandlerFunction,
  handlerName: string
): EventHandlerFunction {
  // 直接使用普通的错误处理，不支持重试
  return withErrorHandling(handler, handlerName);
}
