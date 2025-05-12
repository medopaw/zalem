/**
 * 消息类型注册表
 *
 * 这个文件实现了一个统一的消息类型系统，用于注册、验证和渲染不同类型的消息。
 * 它使用策略模式来处理不同类型的消息，使代码更易于维护和扩展。
 */

import { ReactNode } from 'react';
import { MessageContent, ErrorMessageContent } from '../types/messageContentTypes';
import { DisplayMessage } from '../types/messageStructures';
import logger from './logger';

// 默认文本渲染器标记接口
export interface DefaultTextMark {
  __isDefaultText: true;
  content: string;
}

/**
 * 消息类型枚举
 */
export enum MessageType {
  TEXT = 'text',
  TOOL_CALL = 'tool_call',
  TOOL_CALLS = 'tool_calls',
  TOOL_RESULT = 'tool_result',
  DATA_REQUEST = 'data_request',
  DATA_RESPONSE = 'data_response',
  ERROR = 'error' // 新增错误消息类型
}

/**
 * 消息处理器接口
 */
export interface MessageHandler<T extends MessageContent> {
  /**
   * 验证消息内容是否符合此类型
   * @param obj 要验证的对象
   * @returns 是否符合此类型
   */
  validate: (obj: unknown) => boolean;

  /**
   * 渲染消息内容
   * @param content 消息内容
   * @param message 消息对象
   * @returns 渲染结果
   */
  render: (content: T, message?: DisplayMessage) => ReactNode;
}

/**
 * 消息类型注册表类
 * 用于注册、验证和渲染不同类型的消息
 */
export class MessageTypeRegistry {
  private handlers = new Map<string, MessageHandler<MessageContent>>();

  // 不再需要静态属性来跟踪日志输出，因为我们使用了智能日志系统

  /**
   * 注册消息处理器
   * @param type 消息类型
   * @param handler 消息处理器
   */
  register<T extends MessageContent>(type: string, handler: MessageHandler<T>): void {
    this.handlers.set(type, handler as unknown as MessageHandler<MessageContent>);
  }

  /**
   * 验证消息内容是否符合已注册的类型
   * @param obj 要验证的对象
   * @returns 验证结果，如果有效则返回类型化的对象，否则返回null
   */
  validate(obj: unknown): MessageContent | null {
    // 如果是字符串，直接返回
    if (typeof obj === 'string') {
      return obj;
    }

    // 如果不是对象或没有type字段，返回null
    if (typeof obj !== 'object' || obj === null || !('type' in obj)) {
      return null;
    }

    const type = (obj as { type: string }).type;
    const handler = this.handlers.get(type);

    // 如果找到处理器并且验证通过，返回对象
    if (handler && handler.validate(obj)) {
      return obj as MessageContent;
    }

    return null;
  }

  /**
   * 创建默认文本渲染器
   * 当消息内容是字符串或没有找到处理器时使用
   */
  private createDefaultTextRenderer(content: MessageContent): DefaultTextMark {
    // 注意：这里不能使用JSX语法，因为这不是React组件文件
    // 我们需要返回一个标记，让UnifiedMessageContent组件知道应该使用DefaultTextRenderer
    return {
      __isDefaultText: true,
      content: typeof content === 'string' ? content : JSON.stringify(content, null, 2)
    };
  }

  // 用于跟踪渲染次数
  private renderCounter = new Map<string, number>();

  /**
   * 渲染消息内容
   * @param content 消息内容
   * @param message 消息对象
   * @param fallback 当没有找到处理器时的回退渲染函数（可选）
   * @returns 渲染结果
   */
  render(
    content: MessageContent,
    message?: DisplayMessage,
    fallback?: (content: MessageContent) => ReactNode
  ): ReactNode | DefaultTextMark {
    // 跟踪渲染次数
    const contentKey = message?.id || JSON.stringify(content);
    const currentCount = this.renderCounter.get(contentKey) || 0;
    this.renderCounter.set(contentKey, currentCount + 1);

    console.log(`MessageTypeRegistry.render called ${currentCount + 1} times for message: ${message?.id || 'unknown'}`);

    // 处理null或undefined内容
    if (content === null || content === undefined) {
      console.warn('Content is null or undefined, using empty string');
      return this.createDefaultTextRenderer('');
    }

    // 如果是字符串，尝试解析为JSON对象
    if (typeof content === 'string') {
      try {
        const trimmedContent = content.trim();
        if (trimmedContent.startsWith('{') && trimmedContent.endsWith('}')) {
          console.log('Content is a JSON string, attempting to parse');
          const parsed = JSON.parse(trimmedContent);
          if (parsed && typeof parsed === 'object' && 'type' in parsed) {
            console.log(`Parsed JSON string to object with type: ${parsed.type}`);
            content = parsed;
          } else {
            console.log('Parsed JSON does not have a type field, using as string');
            return fallback ? fallback(content) : this.createDefaultTextRenderer(content);
          }
        } else {
          // 不是JSON字符串，使用默认文本渲染器
          return fallback ? fallback(content) : this.createDefaultTextRenderer(content);
        }
      } catch (e) {
        console.error('Failed to parse content as JSON:', e);
        return fallback ? fallback(content) : this.createDefaultTextRenderer(content);
      }
    }

    // 此时content应该是对象
    if (typeof content !== 'object' || content === null || !('type' in content)) {
      console.warn('Content is not a valid object with type field');
      return fallback ? fallback(content) : this.createDefaultTextRenderer(content);
    }

    // 打印已注册的处理器，用于调试
    const registeredTypes = this.getRegisteredTypes();

    // 使用智能日志系统，避免重复日志
    logger.info(`Rendering message of type: ${content.type}`, undefined, 'MessageTypeRegistry');
    logger.debug('Available handlers:', [registeredTypes], 'MessageTypeRegistry');

    // 如果没有注册处理器，记录警告并使用默认文本渲染器
    if (registeredTypes.length === 0) {
      logger.warn('No message handlers registered for type:', [content.type], 'MessageTypeRegistry');
      return this.createDefaultTextRenderer(content);
    }

    // 处理字符串类型和枚举类型的兼容性
    let handlerKey = content.type;

    // 如果是工具调用结果消息，确保使用正确的处理器
    if (content.type === 'tool_result') {
      handlerKey = MessageType.TOOL_RESULT;
      // 使用智能日志系统，避免重复日志
      logger.debug('Converting tool_result string to MessageType.TOOL_RESULT enum', undefined, 'MessageTypeRegistry');
    }

    const handler = this.handlers.get(handlerKey);

    // 如果找到处理器，使用它渲染
    if (handler) {
      // 使用智能日志系统，避免重复日志
      logger.debug(`Found handler for message type: ${content.type} (handler key: ${handlerKey}), rendering with handler`, undefined, 'MessageTypeRegistry');
      return handler.render(content, message);
    }

    // 如果没有找到处理器，创建错误消息并渲染
    logger.warn(`No handler found for message type: ${content.type}`, undefined, 'MessageTypeRegistry');
    logger.debug('Available handlers after check:', [Array.from(this.handlers.keys())], 'MessageTypeRegistry');
    const errorContent = {
      type: MessageType.ERROR,
      message: `无法渲染消息: 未找到类型 "${content.type}" 的处理器`,
      originalContent: JSON.stringify(content, null, 2)
    };

    const errorHandler = this.handlers.get(MessageType.ERROR);
    if (errorHandler) {
      return errorHandler.render(errorContent as ErrorMessageContent, message);
    }

    // 如果连错误处理器都没有，使用回退函数或默认文本渲染器
    return fallback ? fallback(content) : this.createDefaultTextRenderer(content);
  }

  /**
   * 获取所有已注册的消息类型
   * @returns 消息类型数组
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}

// 使用工厂模式创建和管理实例
let instance: MessageTypeRegistry | null = null;

/**
 * 获取 MessageTypeRegistry 实例
 * 如果实例不存在，则创建一个新实例
 * @returns MessageTypeRegistry 实例
 */
export function getMessageTypeRegistry(): MessageTypeRegistry {
  if (!instance) {
    logger.info('Creating new MessageTypeRegistry instance', undefined, 'MessageTypeRegistry');
    instance = new MessageTypeRegistry();
  }
  return instance;
}

/**
 * 为了向后兼容，保留直接导出的实例
 * 但新代码应该使用 getMessageTypeRegistry() 函数
 * @deprecated 使用 getMessageTypeRegistry() 替代
 */
export const messageTypeRegistry = getMessageTypeRegistry();
