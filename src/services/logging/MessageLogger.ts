/**
 * 消息日志记录器
 *
 * 提供详细的消息日志记录功能
 */

import { DatabaseMessage, DisplayMessage, LLMHistoryMessage } from '../../types/messageStructures';
import { MessageContent } from '../../types/messageContentTypes';
import logger from '../../utils/logger';

/**
 * 消息日志记录器
 */
export class MessageLogger {
  /**
   * 记录数据库消息
   * @param message 数据库消息
   * @param context 日志上下文
   */
  static logDatabaseMessage(message: DatabaseMessage, context = 'database_message'): void {
    logger.info(`[${context}] 数据库消息:`, [{
      id: message.id,
      role: message.role,
      thread_id: message.thread_id,
      user_id: message.user_id,
      is_visible: message.is_visible,
      send_to_llm: message.send_to_llm,
      content_summary: this.getSummary(message.content),
      created_at: message.created_at
    }], 'MessageLogger');
  }

  /**
   * 记录显示消息
   * @param message 显示消息
   * @param context 日志上下文
   */
  static logDisplayMessage(message: DisplayMessage, context = 'display_message'): void {
    logger.info(`[${context}] 显示消息:`, [{
      id: message.id,
      role: message.role,
      user_id: message.user_id,
      content_type: typeof message.content === 'string' ? 'string' : message.content.type,
      content_summary: this.getSummary(message.content),
      created_at: message.created_at
    }], 'MessageLogger');
  }

  /**
   * 记录LLM历史消息
   * @param message LLM历史消息
   * @param context 日志上下文
   */
  static logLLMHistoryMessage(message: LLMHistoryMessage, context = 'llm_history_message'): void {
    logger.info(`[${context}] LLM历史消息:`, [{
      role: message.role,
      content_summary: message.content ? this.getSummary(message.content) : null,
      tool_call_id: message.tool_call_id,
      has_tool_calls: !!message.tool_calls,
      tool_calls_count: message.tool_calls?.length
    }], 'MessageLogger');

    // 如果有工具调用，记录详细信息
    if (message.tool_calls && message.tool_calls.length > 0) {
      logger.debug(`[${context}] LLM历史消息工具调用:`, message.tool_calls.map(call => ({
        id: call.id,
        type: call.type,
        function_name: call.function?.name,
        arguments_summary: call.function?.arguments ? this.getSummary(call.function.arguments) : null
      })), 'MessageLogger');
    }
  }

  /**
   * 记录消息内容
   * @param content 消息内容
   * @param context 日志上下文
   */
  static logMessageContent(content: MessageContent, context = 'message_content'): void {
    if (typeof content === 'string') {
      logger.info(`[${context}] 文本内容:`, [this.getSummary(content)], 'MessageLogger');
      return;
    }

    logger.info(`[${context}] 对象内容:`, [{
      type: content.type,
      summary: this.getObjectSummary(content)
    }], 'MessageLogger');
  }

  /**
   * 获取内容摘要
   * @param content 内容
   * @param maxLength 最大长度
   * @returns 内容摘要
   */
  private static getSummary(content: any, maxLength = 100): string {
    if (content === null || content === undefined) {
      return '<null>';
    }

    if (typeof content === 'string') {
      const summary = content.length > maxLength
        ? `${content.substring(0, maxLength)}...`
        : content;
      return summary.replace(/\n/g, '\\n');
    }

    try {
      const json = typeof content === 'object'
        ? JSON.stringify(content)
        : String(content);
      
      const summary = json.length > maxLength
        ? `${json.substring(0, maxLength)}...`
        : json;
      
      return summary.replace(/\n/g, '\\n');
    } catch (error) {
      return '<无法序列化>';
    }
  }

  /**
   * 获取对象摘要
   * @param obj 对象
   * @returns 对象摘要
   */
  private static getObjectSummary(obj: Record<string, any>): Record<string, any> {
    const summary: Record<string, any> = {};

    // 遍历对象的所有属性
    for (const [key, value] of Object.entries(obj)) {
      // 跳过类型字段，因为已经单独记录
      if (key === 'type') continue;

      // 处理不同类型的值
      if (value === null || value === undefined) {
        summary[key] = value;
      } else if (typeof value === 'string') {
        summary[key] = this.getSummary(value, 50);
      } else if (typeof value === 'object') {
        if (Array.isArray(value)) {
          summary[key] = `Array(${value.length})`;
        } else {
          summary[key] = '{...}';
        }
      } else {
        summary[key] = value;
      }
    }

    return summary;
  }
}
