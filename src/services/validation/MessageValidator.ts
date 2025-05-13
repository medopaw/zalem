/**
 * 消息验证器
 *
 * 提供统一的消息验证和错误反馈机制
 */

import { MessageContent } from '../../types/messageContentTypes';
import { MessageTypeManager } from '../../utils/MessageTypeManager';
import { IErrorReporter, ErrorLevel } from '../error/ErrorReporter';
import logger from '../../utils/logger';
import { DatabaseMessage, DisplayMessage, LLMHistoryMessage } from '../../types/messageStructures';

/**
 * 验证结果接口
 */
export interface ValidationResult<T = any> {
  /**
   * 验证是否通过
   */
  isValid: boolean;

  /**
   * 验证通过时的有效数据
   */
  data?: T;

  /**
   * 验证失败时的错误信息
   */
  error?: {
    /**
     * 错误消息
     */
    message: string;

    /**
     * 错误详情
     */
    details?: string;

    /**
     * 原始内容
     */
    originalContent?: any;
  };
}

/**
 * 消息验证器接口
 */
export interface IMessageValidator {
  /**
   * 验证消息内容
   */
  validateMessageContent(content: any, context?: string): ValidationResult<MessageContent>;

  /**
   * 验证数据库消息
   */
  validateDatabaseMessage(message: any, context?: string): ValidationResult<DatabaseMessage>;

  /**
   * 验证显示消息
   */
  validateDisplayMessage(message: any, context?: string): ValidationResult<DisplayMessage>;

  /**
   * 验证LLM历史消息
   */
  validateLLMHistoryMessage(message: any, context?: string): ValidationResult<LLMHistoryMessage>;

  /**
   * 验证工具调用参数
   */
  validateToolCallArguments(toolName: string, args: any, context?: string): ValidationResult;

  /**
   * 验证工具调用结果
   */
  validateToolResult(result: any, context?: string): ValidationResult;

  /**
   * 报告验证错误
   */
  reportValidationError(result: ValidationResult, context?: string): void;
}

/**
 * 消息验证器实现
 */
export class MessageValidator implements IMessageValidator {
  /**
   * 构造函数
   * @param errorReporter 错误报告服务
   */
  constructor(private errorReporter: IErrorReporter) {}

  /**
   * 验证消息内容
   * @param content 要验证的内容
   * @param context 验证上下文
   * @returns 验证结果
   */
  validateMessageContent(content: any, context = 'message_content'): ValidationResult<MessageContent> {
    logger.debug('验证消息内容:', [{ contentType: typeof content }], 'MessageValidator');

    // 如果是字符串，直接返回有效
    if (typeof content === 'string') {
      return { isValid: true, data: content };
    }

    // 如果不是对象，返回无效
    if (typeof content !== 'object' || content === null) {
      return {
        isValid: false,
        error: {
          message: '无效的消息内容: 不是字符串或对象',
          originalContent: content
        }
      };
    }

    // 使用MessageTypeManager验证
    if (MessageTypeManager.isValidMessageContent(content)) {
      return { isValid: true, data: content };
    }

    // 验证失败
    return {
      isValid: false,
      error: {
        message: '无效的消息内容: 不符合任何已知类型',
        details: '消息内容必须是字符串或包含有效type字段的对象',
        originalContent: content
      }
    };
  }

  /**
   * 验证数据库消息
   * @param message 要验证的消息
   * @param context 验证上下文
   * @returns 验证结果
   */
  validateDatabaseMessage(message: any, context = 'database_message'): ValidationResult<DatabaseMessage> {
    logger.debug('验证数据库消息:', [{ messageId: message?.id }], 'MessageValidator');

    // 基本字段验证
    if (typeof message !== 'object' || message === null) {
      return {
        isValid: false,
        error: {
          message: '无效的数据库消息: 不是对象',
          originalContent: message
        }
      };
    }

    // 必要字段验证
    const requiredFields = ['id', 'content', 'role', 'created_at', 'user_id', 'thread_id'];
    const missingFields = requiredFields.filter(field => !(field in message));

    if (missingFields.length > 0) {
      return {
        isValid: false,
        error: {
          message: `无效的数据库消息: 缺少必要字段 ${missingFields.join(', ')}`,
          originalContent: message
        }
      };
    }

    // 角色验证
    const validRoles = ['user', 'assistant', 'system', 'tool'];
    if (!validRoles.includes(message.role)) {
      return {
        isValid: false,
        error: {
          message: `无效的数据库消息: 角色 "${message.role}" 不是有效的角色`,
          details: `有效角色: ${validRoles.join(', ')}`,
          originalContent: message
        }
      };
    }

    // 验证通过
    return { isValid: true, data: message as DatabaseMessage };
  }

  /**
   * 验证显示消息
   * @param message 要验证的消息
   * @param context 验证上下文
   * @returns 验证结果
   */
  validateDisplayMessage(message: any, context = 'display_message'): ValidationResult<DisplayMessage> {
    logger.debug('验证显示消息:', [{ messageId: message?.id }], 'MessageValidator');

    // 基本字段验证
    if (typeof message !== 'object' || message === null) {
      return {
        isValid: false,
        error: {
          message: '无效的显示消息: 不是对象',
          originalContent: message
        }
      };
    }

    // 必要字段验证
    const requiredFields = ['id', 'content', 'role', 'created_at', 'user_id'];
    const missingFields = requiredFields.filter(field => !(field in message));

    if (missingFields.length > 0) {
      return {
        isValid: false,
        error: {
          message: `无效的显示消息: 缺少必要字段 ${missingFields.join(', ')}`,
          originalContent: message
        }
      };
    }

    // 角色验证
    const validRoles = ['user', 'assistant', 'system', 'tool'];
    if (!validRoles.includes(message.role)) {
      return {
        isValid: false,
        error: {
          message: `无效的显示消息: 角色 "${message.role}" 不是有效的角色`,
          details: `有效角色: ${validRoles.join(', ')}`,
          originalContent: message
        }
      };
    }

    // 内容验证
    const contentResult = this.validateMessageContent(message.content, `${context}.content`);
    if (!contentResult.isValid) {
      return {
        isValid: false,
        error: {
          message: `无效的显示消息: 内容无效 - ${contentResult.error?.message}`,
          details: contentResult.error?.details,
          originalContent: message
        }
      };
    }

    // 验证通过
    return { isValid: true, data: message as DisplayMessage };
  }

  /**
   * 验证LLM历史消息
   * @param message 要验证的消息
   * @param context 验证上下文
   * @returns 验证结果
   */
  validateLLMHistoryMessage(message: any, context = 'llm_history_message'): ValidationResult<LLMHistoryMessage> {
    logger.debug('验证LLM历史消息:', [{ messageRole: message?.role }], 'MessageValidator');

    // 基本字段验证
    if (typeof message !== 'object' || message === null) {
      return {
        isValid: false,
        error: {
          message: '无效的LLM历史消息: 不是对象',
          originalContent: message
        }
      };
    }

    // 必要字段验证
    if (!('role' in message)) {
      return {
        isValid: false,
        error: {
          message: '无效的LLM历史消息: 缺少必要字段 role',
          originalContent: message
        }
      };
    }

    // 角色验证
    const validRoles = ['user', 'assistant', 'system', 'tool'];
    if (!validRoles.includes(message.role)) {
      return {
        isValid: false,
        error: {
          message: `无效的LLM历史消息: 角色 "${message.role}" 不是有效的角色`,
          details: `有效角色: ${validRoles.join(', ')}`,
          originalContent: message
        }
      };
    }

    // 内容验证 - 对于assistant角色，content可以为null，但必须有tool_calls
    if (message.role === 'assistant' && message.content === null) {
      if (!message.tool_calls || !Array.isArray(message.tool_calls) || message.tool_calls.length === 0) {
        return {
          isValid: false,
          error: {
            message: '无效的LLM历史消息: assistant角色消息的content为null时必须有tool_calls',
            originalContent: message
          }
        };
      }
    } else if (message.content === undefined) {
      return {
        isValid: false,
        error: {
          message: '无效的LLM历史消息: 缺少必要字段 content',
          originalContent: message
        }
      };
    }

    // 工具角色验证
    if (message.role === 'tool' && !message.tool_call_id) {
      return {
        isValid: false,
        error: {
          message: '无效的LLM历史消息: tool角色消息必须有tool_call_id',
          originalContent: message
        }
      };
    }

    // 验证通过
    return { isValid: true, data: message as LLMHistoryMessage };
  }

  /**
   * 验证工具调用参数
   * @param toolName 工具名称
   * @param args 工具参数
   * @param context 验证上下文
   * @returns 验证结果
   */
  validateToolCallArguments(toolName: string, args: any, context = 'tool_call_arguments'): ValidationResult {
    logger.debug('验证工具调用参数:', [{ toolName, argsType: typeof args }], 'MessageValidator');

    // 基本验证
    if (typeof args !== 'object' || args === null) {
      return {
        isValid: false,
        error: {
          message: `无效的工具调用参数: 不是对象`,
          originalContent: args
        }
      };
    }

    // 工具特定验证 - 可以根据不同工具添加特定验证逻辑
    // 这里只是一个示例，实际应用中可以根据需要扩展
    switch (toolName) {
      case 'set_nickname':
        if (!('nickname' in args)) {
          return {
            isValid: false,
            error: {
              message: '无效的set_nickname参数: 缺少必要字段 nickname',
              originalContent: args
            }
          };
        }
        break;

      // 可以添加更多工具的验证逻辑
    }

    // 验证通过
    return { isValid: true, data: args };
  }

  /**
   * 验证工具调用结果
   * @param result 工具调用结果
   * @param context 验证上下文
   * @returns 验证结果
   */
  validateToolResult(result: any, context = 'tool_result'): ValidationResult {
    logger.debug('验证工具调用结果:', [{ resultType: typeof result }], 'MessageValidator');

    // 基本字段验证
    if (typeof result !== 'object' || result === null) {
      return {
        isValid: false,
        error: {
          message: '无效的工具调用结果: 不是对象',
          originalContent: result
        }
      };
    }

    // 必要字段验证
    const requiredFields = ['toolCallId', 'status', 'message'];
    const missingFields = requiredFields.filter(field => !(field in result));

    if (missingFields.length > 0) {
      return {
        isValid: false,
        error: {
          message: `无效的工具调用结果: 缺少必要字段 ${missingFields.join(', ')}`,
          originalContent: result
        }
      };
    }

    // 状态验证
    const validStatuses = ['success', 'error'];
    if (!validStatuses.includes(result.status)) {
      return {
        isValid: false,
        error: {
          message: `无效的工具调用结果: 状态 "${result.status}" 不是有效的状态`,
          details: `有效状态: ${validStatuses.join(', ')}`,
          originalContent: result
        }
      };
    }

    // 验证通过
    return { isValid: true, data: result };
  }

  /**
   * 报告验证错误
   * @param result 验证结果
   * @param context 验证上下文
   */
  reportValidationError(result: ValidationResult, context = 'validation'): void {
    if (!result.isValid && result.error) {
      logger.error('验证错误:', [result.error], 'MessageValidator');

      this.errorReporter.reportToUI({
        title: '消息格式错误',
        message: result.error.message,
        level: ErrorLevel.ERROR,
        details: result.error.details || JSON.stringify(result.error.originalContent, null, 2),
        context: context
      });
    }
  }
}
