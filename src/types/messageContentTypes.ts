/**
 * 消息内容类型定义
 *
 * 本文件定义了所有可能的消息内容类型，使用判别联合类型（Discriminated Union Types）
 * 确保类型安全和代码可维护性。
 *
 * 注意：类型守卫函数将逐渐被 MessageTypeRegistry 替代，但为了向后兼容而保留。
 */

import { MessageType } from '../utils/MessageTypeRegistry';

/**
 * 基础消息内容接口
 * 所有结构化消息内容都必须实现这个接口
 */
export interface BaseMessageContent {
  /** 消息类型标识符 */
  type: string;
}

/**
 * 纯文本消息内容
 */
export interface TextMessageContent extends BaseMessageContent {
  type: MessageType.TEXT;
  /** 文本内容 */
  text: string;
}

/**
 * 单个工具调用消息内容
 */
export interface ToolCallContent extends BaseMessageContent {
  type: MessageType.TOOL_CALL;
  /** 工具名称 */
  name: string;
  /** 工具参数 */
  parameters: Record<string, unknown>;
}

/**
 * 多个工具调用消息内容
 */
export interface ToolCallsContent extends BaseMessageContent {
  type: MessageType.TOOL_CALLS;
  /** 工具调用列表 */
  calls: Array<{
    /** 工具调用ID */
    id: string;
    /** 工具名称 */
    name: string;
    /** 工具参数 */
    parameters: Record<string, unknown>;
  }>;
}

/**
 * 工具调用结果消息内容
 */
export interface ToolResultContent extends BaseMessageContent {
  type: MessageType.TOOL_RESULT;
  /** 关联的工具调用ID */
  tool_call_id: string;
  /** 执行状态 */
  status: 'success' | 'error';
  /** 结果消息 */
  message: string;
  /** 详细信息（可选） */
  details?: string;
}

/**
 * 数据请求消息内容
 */
export interface DataRequestContent extends BaseMessageContent {
  type: MessageType.DATA_REQUEST;
  /** 请求的字段列表 */
  fields: string[];
}

/**
 * 数据响应消息内容
 */
export interface DataResponseContent extends BaseMessageContent {
  type: MessageType.DATA_RESPONSE;
  /** 响应数据 */
  data: Record<string, unknown>;
}

/**
 * 错误消息内容
 * 用于表示无法识别或解析的消息内容
 */
export interface ErrorMessageContent extends BaseMessageContent {
  type: MessageType.ERROR;
  /** 错误消息 */
  message: string;
  /** 原始内容的JSON字符串 */
  originalContent: string;
}

/**
 * 消息内容联合类型
 * 可以是字符串或任何结构化消息内容类型
 */
export type MessageContent =
  | string
  | TextMessageContent
  | ToolCallContent
  | ToolCallsContent
  | ToolResultContent
  | DataRequestContent
  | DataResponseContent
  | ErrorMessageContent;

/**
 * 消息类型字符串联合类型
 * 用于类型检查和验证
 */
export type MessageContentTypeString =
  | 'text'
  | 'tool_call'
  | 'tool_calls'
  | 'tool_result'
  | 'data_request'
  | 'data_response'
  | 'error';

/**
 * 类型守卫函数：检查对象是否为基础消息内容
 */
export function isBaseMessageContent(obj: unknown): obj is BaseMessageContent {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    typeof (obj as BaseMessageContent).type === 'string'
  );
}

/**
 * 类型守卫函数：检查对象是否为文本消息内容
 */
export function isTextMessageContent(obj: unknown): obj is TextMessageContent {
  return (
    isBaseMessageContent(obj) &&
    obj.type === MessageType.TEXT &&
    'text' in obj &&
    typeof (obj as TextMessageContent).text === 'string'
  );
}

/**
 * 类型守卫函数：检查对象是否为工具调用消息内容
 */
export function isToolCallContent(obj: unknown): obj is ToolCallContent {
  return (
    isBaseMessageContent(obj) &&
    obj.type === MessageType.TOOL_CALL &&
    'name' in obj &&
    typeof (obj as ToolCallContent).name === 'string' &&
    'parameters' in obj &&
    typeof (obj as ToolCallContent).parameters === 'object'
  );
}

/**
 * 类型守卫函数：检查对象是否为多个工具调用消息内容
 */
export function isToolCallsContent(obj: unknown): obj is ToolCallsContent {
  return (
    isBaseMessageContent(obj) &&
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
}

/**
 * 类型守卫函数：检查对象是否为工具调用结果消息内容
 */
export function isToolResultContent(obj: unknown): obj is ToolResultContent {
  return (
    isBaseMessageContent(obj) &&
    obj.type === MessageType.TOOL_RESULT &&
    'tool_call_id' in obj &&
    typeof (obj as ToolResultContent).tool_call_id === 'string' &&
    'status' in obj &&
    ['success', 'error'].includes((obj as ToolResultContent).status) &&
    'message' in obj &&
    typeof (obj as ToolResultContent).message === 'string'
  );
}

/**
 * 类型守卫函数：检查对象是否为数据请求消息内容
 */
export function isDataRequestContent(obj: unknown): obj is DataRequestContent {
  return (
    isBaseMessageContent(obj) &&
    obj.type === MessageType.DATA_REQUEST &&
    'fields' in obj &&
    Array.isArray((obj as DataRequestContent).fields) &&
    (obj as DataRequestContent).fields.every(field => typeof field === 'string')
  );
}

/**
 * 类型守卫函数：检查对象是否为数据响应消息内容
 */
export function isDataResponseContent(obj: unknown): obj is DataResponseContent {
  return (
    isBaseMessageContent(obj) &&
    obj.type === MessageType.DATA_RESPONSE &&
    'data' in obj &&
    typeof (obj as DataResponseContent).data === 'object'
  );
}

/**
 * 验证消息内容类型
 * @param obj 要验证的对象
 * @returns 验证结果，如果有效则返回类型化的对象，否则返回null
 *
 * @deprecated 使用 messageTypeRegistry.validate 替代
 */
export function validateMessageContent(obj: unknown): MessageContent | null {
  if (typeof obj === 'string') {
    return obj;
  }

  if (isTextMessageContent(obj)) return obj;
  if (isToolCallContent(obj)) return obj;
  if (isToolCallsContent(obj)) return obj;
  if (isToolResultContent(obj)) return obj;
  if (isDataRequestContent(obj)) return obj;
  if (isDataResponseContent(obj)) return obj;

  return null;
}

// 不再从这里导出 messageTypeRegistry，避免循环依赖
