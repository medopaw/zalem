/**
 * 消息类型注册表
 *
 * 这个文件实现了一个统一的消息类型系统，用于注册、验证和渲染不同类型的消息。
 * 它使用策略模式来处理不同类型的消息，使代码更易于维护和扩展。
 */

import { ReactNode } from 'react';
import { MessageContent, ErrorMessageContent } from '../types/messageContentTypes';
import { DisplayMessage } from '../types/messageStructures';

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
  private handlers = new Map<string, MessageHandler<any>>();

  /**
   * 注册消息处理器
   * @param type 消息类型
   * @param handler 消息处理器
   */
  register<T extends MessageContent>(type: string, handler: MessageHandler<T>): void {
    this.handlers.set(type, handler as unknown as MessageHandler<any>);
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
    // 如果是字符串，使用默认文本渲染器或自定义回退函数
    if (typeof content === 'string') {
      return fallback ? fallback(content) : this.createDefaultTextRenderer(content);
    }

    const handler = this.handlers.get(content.type);

    // 如果找到处理器，使用它渲染
    if (handler) {
      return handler.render(content, message);
    }

    // 如果没有找到处理器，创建错误消息并渲染
    console.warn(`No handler found for message type: ${content.type}`);
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

// 创建并导出单例实例
export const messageTypeRegistry = new MessageTypeRegistry();
