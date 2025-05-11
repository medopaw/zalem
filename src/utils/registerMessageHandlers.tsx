/**
 * 注册消息处理器
 *
 * 这个文件注册所有消息类型的处理器，包括验证和渲染逻辑。
 */

import { ReactNode } from 'react';
import { messageTypeRegistry, MessageType } from './MessageTypeRegistry';
import {
  TextMessageContent,
  ToolCallContent,
  ToolCallsContent,
  ToolResultContent,
  DataRequestContent,
  DataResponseContent,
  ErrorMessageContent
} from '../types/messageContentTypes';

// 导入渲染组件
import TextRenderer from '../components/messageRenderers/TextRenderer';
import ToolCallRenderer from '../components/messageRenderers/ToolCallRenderer';
import ToolCallsRenderer from '../components/messageRenderers/ToolCallsRenderer';
import ToolResultRenderer from '../components/messageRenderers/ToolResultRenderer';
import DataRequestRenderer from '../components/messageRenderers/DataRequestRenderer';
import DataResponseRenderer from '../components/messageRenderers/DataResponseRenderer';
import ErrorRenderer from '../components/messageRenderers/ErrorRenderer';

/**
 * 注册文本消息处理器
 */
messageTypeRegistry.register<TextMessageContent>(MessageType.TEXT, {
  validate: (obj): boolean => {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'type' in obj &&
      obj.type === MessageType.TEXT &&
      'text' in obj &&
      typeof (obj as TextMessageContent).text === 'string'
    );
  },
  render: (content, message) => <TextRenderer content={content} message={message} />
});

/**
 * 注册工具调用消息处理器
 */
messageTypeRegistry.register<ToolCallContent>(MessageType.TOOL_CALL, {
  validate: (obj): boolean => {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'type' in obj &&
      obj.type === MessageType.TOOL_CALL &&
      'name' in obj &&
      typeof (obj as ToolCallContent).name === 'string' &&
      'parameters' in obj &&
      typeof (obj as ToolCallContent).parameters === 'object'
    );
  },
  render: (content) => <ToolCallRenderer content={content} />
});

/**
 * 注册多个工具调用消息处理器
 */
messageTypeRegistry.register<ToolCallsContent>(MessageType.TOOL_CALLS, {
  validate: (obj): boolean => {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'type' in obj &&
      obj.type === MessageType.TOOL_CALLS &&
      'calls' in obj &&
      Array.isArray((obj as ToolCallsContent).calls) &&
      (obj as ToolCallsContent).calls.every(call =>
        typeof call === 'object' &&
        call !== null &&
        'id' in call &&
        typeof call.id === 'string' &&
        'name' in call &&
        typeof call.name === 'string' &&
        'parameters' in call &&
        typeof call.parameters === 'object'
      )
    );
  },
  render: (content) => <ToolCallsRenderer content={content} />
});

/**
 * 注册工具调用结果消息处理器
 */
messageTypeRegistry.register<ToolResultContent>(MessageType.TOOL_RESULT, {
  validate: (obj): boolean => {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'type' in obj &&
      obj.type === MessageType.TOOL_RESULT &&
      'tool_call_id' in obj &&
      typeof (obj as ToolResultContent).tool_call_id === 'string' &&
      'status' in obj &&
      ['success', 'error'].includes((obj as ToolResultContent).status) &&
      'message' in obj &&
      typeof (obj as ToolResultContent).message === 'string'
    );
  },
  render: (content) => <ToolResultRenderer content={content} />
});

/**
 * 注册数据请求消息处理器
 */
messageTypeRegistry.register<DataRequestContent>(MessageType.DATA_REQUEST, {
  validate: (obj): boolean => {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'type' in obj &&
      obj.type === MessageType.DATA_REQUEST &&
      'fields' in obj &&
      Array.isArray((obj as DataRequestContent).fields) &&
      (obj as DataRequestContent).fields.every(field => typeof field === 'string')
    );
  },
  render: (content) => <DataRequestRenderer content={content} />
});

/**
 * 注册数据响应消息处理器
 */
messageTypeRegistry.register<DataResponseContent>(MessageType.DATA_RESPONSE, {
  validate: (obj): boolean => {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'type' in obj &&
      obj.type === MessageType.DATA_RESPONSE &&
      'data' in obj &&
      typeof (obj as DataResponseContent).data === 'object'
    );
  },
  render: (content) => <DataResponseRenderer content={content} />
});

/**
 * 注册错误消息处理器
 */
messageTypeRegistry.register<ErrorMessageContent>(MessageType.ERROR, {
  validate: (obj): boolean => {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'type' in obj &&
      obj.type === MessageType.ERROR &&
      'message' in obj &&
      typeof (obj as ErrorMessageContent).message === 'string' &&
      'originalContent' in obj &&
      typeof (obj as ErrorMessageContent).originalContent === 'string'
    );
  },
  render: (content) => <ErrorRenderer content={content} />
});

/**
 * 初始化消息处理器
 * 在应用启动时调用此函数
 */
export function initializeMessageHandlers(): void {
  // 这个函数的存在只是为了确保这个文件被导入
  console.log('Message handlers initialized');
}
