/**
 * 消息验证增强器
 *
 * 为消息处理函数添加验证和日志记录功能
 */

import { DatabaseMessage, DisplayMessage, LLMHistoryMessage } from '../../types/messageStructures';
import { MessageContent } from '../../types/messageContentTypes';
import { getMessageValidator } from './MessageValidatorProvider';
import { MessageLogger } from '../logging/MessageLogger';
import logger from '../../utils/logger';

/**
 * 消息处理函数类型
 */
type MessageProcessorFunction<T, R> = (message: T) => R;

/**
 * 为消息内容处理函数添加验证和日志记录
 * @param processor 原始处理函数
 * @param context 处理上下文
 * @returns 增强后的处理函数
 */
export function withContentValidation<R>(
  processor: MessageProcessorFunction<MessageContent, R>,
  context = 'content_processor'
): MessageProcessorFunction<MessageContent, R> {
  return (content: MessageContent): R => {
    // 记录日志
    MessageLogger.logMessageContent(content, context);

    // 验证消息内容
    const validator = getMessageValidator();
    const result = validator.validateMessageContent(content, context);

    if (!result.isValid) {
      // 报告验证错误
      validator.reportValidationError(result, context);
      throw new Error(`消息内容验证失败: ${result.error?.message}`);
    }

    // 调用原始处理函数
    try {
      logger.debug(`[${context}] 开始处理消息内容`, undefined, 'MessageValidationEnhancer');
      const processed = processor(content);
      logger.debug(`[${context}] 消息内容处理完成`, undefined, 'MessageValidationEnhancer');
      return processed;
    } catch (error) {
      logger.error(`[${context}] 处理消息内容时出错:`, [error], 'MessageValidationEnhancer');
      throw error;
    }
  };
}

/**
 * 为数据库消息处理函数添加验证和日志记录
 * @param processor 原始处理函数
 * @param context 处理上下文
 * @returns 增强后的处理函数
 */
export function withDatabaseMessageValidation<R>(
  processor: MessageProcessorFunction<DatabaseMessage, R>,
  context = 'database_message_processor'
): MessageProcessorFunction<DatabaseMessage, R> {
  return (message: DatabaseMessage): R => {
    // 记录日志
    MessageLogger.logDatabaseMessage(message, context);

    // 验证数据库消息
    const validator = getMessageValidator();
    const result = validator.validateDatabaseMessage(message, context);

    if (!result.isValid) {
      // 报告验证错误
      validator.reportValidationError(result, context);
      throw new Error(`数据库消息验证失败: ${result.error?.message}`);
    }

    // 调用原始处理函数
    try {
      logger.debug(`[${context}] 开始处理数据库消息`, undefined, 'MessageValidationEnhancer');
      const processed = processor(message);
      logger.debug(`[${context}] 数据库消息处理完成`, undefined, 'MessageValidationEnhancer');
      return processed;
    } catch (error) {
      logger.error(`[${context}] 处理数据库消息时出错:`, [error], 'MessageValidationEnhancer');
      throw error;
    }
  };
}

/**
 * 为显示消息处理函数添加验证和日志记录
 * @param processor 原始处理函数
 * @param context 处理上下文
 * @returns 增强后的处理函数
 */
export function withDisplayMessageValidation<R>(
  processor: MessageProcessorFunction<DisplayMessage, R>,
  context = 'display_message_processor'
): MessageProcessorFunction<DisplayMessage, R> {
  return (message: DisplayMessage): R => {
    // 记录日志
    MessageLogger.logDisplayMessage(message, context);

    // 验证显示消息
    const validator = getMessageValidator();
    const result = validator.validateDisplayMessage(message, context);

    if (!result.isValid) {
      // 报告验证错误
      validator.reportValidationError(result, context);
      throw new Error(`显示消息验证失败: ${result.error?.message}`);
    }

    // 调用原始处理函数
    try {
      logger.debug(`[${context}] 开始处理显示消息`, undefined, 'MessageValidationEnhancer');
      const processed = processor(message);
      logger.debug(`[${context}] 显示消息处理完成`, undefined, 'MessageValidationEnhancer');
      return processed;
    } catch (error) {
      logger.error(`[${context}] 处理显示消息时出错:`, [error], 'MessageValidationEnhancer');
      throw error;
    }
  };
}

/**
 * 为LLM历史消息处理函数添加验证和日志记录
 * @param processor 原始处理函数
 * @param context 处理上下文
 * @returns 增强后的处理函数
 */
export function withLLMHistoryMessageValidation<R>(
  processor: MessageProcessorFunction<LLMHistoryMessage, R>,
  context = 'llm_history_message_processor'
): MessageProcessorFunction<LLMHistoryMessage, R> {
  return (message: LLMHistoryMessage): R => {
    // 记录日志
    MessageLogger.logLLMHistoryMessage(message, context);

    // 验证LLM历史消息
    const validator = getMessageValidator();
    const result = validator.validateLLMHistoryMessage(message, context);

    if (!result.isValid) {
      // 报告验证错误
      validator.reportValidationError(result, context);
      throw new Error(`LLM历史消息验证失败: ${result.error?.message}`);
    }

    // 调用原始处理函数
    try {
      logger.debug(`[${context}] 开始处理LLM历史消息`, undefined, 'MessageValidationEnhancer');
      const processed = processor(message);
      logger.debug(`[${context}] LLM历史消息处理完成`, undefined, 'MessageValidationEnhancer');
      return processed;
    } catch (error) {
      logger.error(`[${context}] 处理LLM历史消息时出错:`, [error], 'MessageValidationEnhancer');
      throw error;
    }
  };
}

/**
 * 为工具调用参数处理函数添加验证和日志记录
 * @param toolName 工具名称
 * @param processor 原始处理函数
 * @param context 处理上下文
 * @returns 增强后的处理函数
 */
export function withToolCallArgumentsValidation<R>(
  toolName: string,
  processor: MessageProcessorFunction<any, R>,
  context = 'tool_call_arguments_processor'
): MessageProcessorFunction<any, R> {
  return (args: any): R => {
    // 记录日志
    logger.info(`[${context}] 工具调用参数:`, [{
      toolName,
      args: args
    }], 'MessageValidationEnhancer');

    // 验证工具调用参数
    const validator = getMessageValidator();
    const result = validator.validateToolCallArguments(toolName, args, context);

    if (!result.isValid) {
      // 报告验证错误
      validator.reportValidationError(result, context);
      throw new Error(`工具调用参数验证失败: ${result.error?.message}`);
    }

    // 调用原始处理函数
    try {
      logger.debug(`[${context}] 开始处理工具调用参数`, undefined, 'MessageValidationEnhancer');
      const processed = processor(args);
      logger.debug(`[${context}] 工具调用参数处理完成`, undefined, 'MessageValidationEnhancer');
      return processed;
    } catch (error) {
      logger.error(`[${context}] 处理工具调用参数时出错:`, [error], 'MessageValidationEnhancer');
      throw error;
    }
  };
}

/**
 * 为工具调用结果处理函数添加验证和日志记录
 * @param processor 原始处理函数
 * @param context 处理上下文
 * @returns 增强后的处理函数
 */
export function withToolResultValidation<R>(
  processor: MessageProcessorFunction<any, R>,
  context = 'tool_result_processor'
): MessageProcessorFunction<any, R> {
  return (result: any): R => {
    // 记录日志
    logger.info(`[${context}] 工具调用结果:`, [{
      toolCallId: result?.toolCallId,
      status: result?.status,
      message: result?.message
    }], 'MessageValidationEnhancer');

    // 验证工具调用结果
    const validator = getMessageValidator();
    const validationResult = validator.validateToolResult(result, context);

    if (!validationResult.isValid) {
      // 报告验证错误
      validator.reportValidationError(validationResult, context);
      throw new Error(`工具调用结果验证失败: ${validationResult.error?.message}`);
    }

    // 调用原始处理函数
    try {
      logger.debug(`[${context}] 开始处理工具调用结果`, undefined, 'MessageValidationEnhancer');
      const processed = processor(result);
      logger.debug(`[${context}] 工具调用结果处理完成`, undefined, 'MessageValidationEnhancer');
      return processed;
    } catch (error) {
      logger.error(`[${context}] 处理工具调用结果时出错:`, [error], 'MessageValidationEnhancer');
      throw error;
    }
  };
}
