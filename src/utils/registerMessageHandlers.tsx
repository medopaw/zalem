/**
 * 注册消息处理器
 *
 * 这个文件注册所有消息类型的处理器，包括验证和渲染逻辑。
 */

import { ReactNode } from 'react';
import { MessageType, MessageTypeRegistry } from './MessageTypeRegistry';
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

// 消息处理器将在 initializeMessageHandlers 函数中注册

// 使用 Map 记录已注册的实例
const registeredInstances = new Map<MessageTypeRegistry, boolean>();

/**
 * 初始化消息处理器
 *
 * @param registry MessageTypeRegistry 实例
 * @returns 是否成功初始化
 */
export function initializeMessageHandlers(registry: MessageTypeRegistry): boolean {
  // 如果已经为此实例注册过，直接返回
  if (registeredInstances.has(registry)) {
    console.log('[MessageHandlers] Already initialized for this registry instance, skipping');
    return true;
  }

  console.log('[MessageHandlers] Initializing message handlers...');

  // 注册文本消息处理器
  registry.register<TextMessageContent>(MessageType.TEXT, {
    validate: (obj: unknown): boolean => {
      return (
        typeof obj === 'object' &&
        obj !== null &&
        'type' in obj &&
        obj.type === MessageType.TEXT &&
        'text' in obj &&
        typeof (obj as TextMessageContent).text === 'string'
      );
    },
    render: (content: TextMessageContent, message?: any) => <TextRenderer content={content} message={message} />
  });

  // 注册工具调用消息处理器
  registry.register<ToolCallContent>(MessageType.TOOL_CALL, {
    validate: (obj: unknown): boolean => {
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
    render: (content: ToolCallContent) => <ToolCallRenderer content={content} />
  });

  // 注册多个工具调用消息处理器
  registry.register<ToolCallsContent>(MessageType.TOOL_CALLS, {
    validate: (obj: unknown): boolean => {
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
    render: (content: ToolCallsContent) => <ToolCallsRenderer content={content} />
  });

  // 注册工具调用结果消息处理器
  registry.register<ToolResultContent>(MessageType.TOOL_RESULT, {
    validate: (obj: unknown): boolean => {
      console.log('Validating tool result:', obj);
      const isValid = (
        typeof obj === 'object' &&
        obj !== null &&
        'type' in obj &&
        (obj.type === MessageType.TOOL_RESULT || obj.type === 'tool_result') &&
        'tool_call_id' in obj &&
        typeof (obj as ToolResultContent).tool_call_id === 'string' &&
        'status' in obj &&
        ['success', 'error'].includes((obj as ToolResultContent).status) &&
        'message' in obj &&
        typeof (obj as ToolResultContent).message === 'string'
      );
      console.log('Tool result validation result:', isValid);
      return isValid;
    },
    render: (content: ToolResultContent) => {
      console.log('Rendering tool result in handler:', content);
      return <ToolResultRenderer content={content} />;
    }
  });

  // 注册数据请求消息处理器
  registry.register<DataRequestContent>(MessageType.DATA_REQUEST, {
    validate: (obj: unknown): boolean => {
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
    render: (content: DataRequestContent) => <DataRequestRenderer content={content} />
  });

  // 注册数据响应消息处理器
  registry.register<DataResponseContent>(MessageType.DATA_RESPONSE, {
    validate: (obj: unknown): boolean => {
      return (
        typeof obj === 'object' &&
        obj !== null &&
        'type' in obj &&
        obj.type === MessageType.DATA_RESPONSE &&
        'data' in obj &&
        typeof (obj as DataResponseContent).data === 'object'
      );
    },
    render: (content: DataResponseContent) => <DataResponseRenderer content={content} />
  });

  // 注册错误消息处理器
  registry.register<ErrorMessageContent>(MessageType.ERROR, {
    validate: (obj: unknown): boolean => {
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
    render: (content: ErrorMessageContent) => <ErrorRenderer content={content} />
  });

  // 标记为已注册
  registeredInstances.set(registry, true);
  console.log('[MessageHandlers] Message handlers initialized');

  // 打印已注册的消息类型
  const registeredTypes = registry.getRegisteredTypes();
  console.log('[MessageHandlers] Registered message types:', registeredTypes);

  // 检查是否成功注册了消息处理器
  if (registeredTypes.length === 0) {
    console.error('[MessageHandlers] No message handlers registered! This is unexpected.');

    // 记录更详细的调试信息，帮助诊断问题
    console.debug('[MessageHandlers] Registry instance:', registry);
    console.debug('[MessageHandlers] Available message types:', Object.values(MessageType));
    console.debug('[MessageHandlers] React components loaded:',
      typeof TextRenderer !== 'undefined' &&
      typeof ToolCallRenderer !== 'undefined' &&
      typeof ToolCallsRenderer !== 'undefined');

    // 检查React组件是否已加载
    if (typeof TextRenderer === 'undefined' ||
        typeof ToolCallRenderer === 'undefined' ||
        typeof ToolCallsRenderer === 'undefined') {
      console.error('[MessageHandlers] React components not loaded yet. This is likely the cause of initialization failure.');

      // 抛出明确的错误，而不是返回false
      throw new Error('React components not loaded yet. System initialization should be delayed until components are available.');
    }

    // 重置标志，允许下次重试
    registeredInstances.delete(registry);
    return false;
  }

  return true;
}
