import { describe, test, expect, vi } from 'vitest';
import { MessageTypeManager, MessageType } from './MessageTypeManager';
import {
  DatabaseMessage,
  DisplayMessage,
  LLMHistoryMessage
} from '../types/messageStructures';
import logger from './logger';

// 模拟logger
vi.mock('./logger', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn()
  }
}));

describe('MessageTypeManager', () => {
  // 测试数据
  const userId = 'user-123';
  const threadId = 'thread-456';
  const toolCallId = 'call-789';

  describe('类型守卫函数', () => {
    test('isToolCall 应正确识别工具调用内容', () => {
      const validToolCall = {
        type: MessageType.TOOL_CALL,
        id: 'call-1',
        name: 'test_function',
        arguments: '{"param": "value"}'
      };

      const invalidToolCall1 = {
        type: MessageType.TOOL_CALL,
        name: 'test_function',
        arguments: '{"param": "value"}'
        // 缺少id
      };

      const invalidToolCall2 = {
        type: 'not_tool_call',
        id: 'call-1',
        name: 'test_function',
        arguments: '{"param": "value"}'
      };

      expect(MessageTypeManager.isToolCall(validToolCall)).toBe(true);
      expect(MessageTypeManager.isToolCall(invalidToolCall1)).toBe(false);
      expect(MessageTypeManager.isToolCall(invalidToolCall2)).toBe(false);
      expect(MessageTypeManager.isToolCall('string')).toBe(false);
      expect(MessageTypeManager.isToolCall(null)).toBe(false);
    });

    test('isToolCalls 应正确识别多个工具调用内容', () => {
      const validToolCalls = {
        type: MessageType.TOOL_CALLS,
        tool_calls: [
          {
            id: 'call-1',
            type: 'function',
            function: {
              name: 'test_function',
              arguments: '{"param": "value"}'
            }
          }
        ]
      };

      const invalidToolCalls1 = {
        type: MessageType.TOOL_CALLS,
        // 缺少tool_calls
      };

      const invalidToolCalls2 = {
        type: MessageType.TOOL_CALLS,
        tool_calls: 'not an array'
      };

      expect(MessageTypeManager.isToolCalls(validToolCalls)).toBe(true);
      expect(MessageTypeManager.isToolCalls(invalidToolCalls1)).toBe(false);
      expect(MessageTypeManager.isToolCalls(invalidToolCalls2)).toBe(false);
    });

    test('isToolResult 应正确识别工具调用结果内容', () => {
      const validToolResult = {
        type: MessageType.TOOL_RESULT,
        tool_call_id: 'call-1',
        status: 'success',
        message: '操作成功'
      };

      const invalidToolResult1 = {
        type: MessageType.TOOL_RESULT,
        status: 'success',
        message: '操作成功'
        // 缺少tool_call_id
      };

      const invalidToolResult2 = {
        type: 'not_tool_result',
        tool_call_id: 'call-1',
        status: 'success',
        message: '操作成功'
      };

      expect(MessageTypeManager.isToolResult(validToolResult)).toBe(true);
      expect(MessageTypeManager.isToolResult(invalidToolResult1)).toBe(false);
      expect(MessageTypeManager.isToolResult(invalidToolResult2)).toBe(false);
    });

    test('isValidMessageContent 应正确验证消息内容', () => {
      // 字符串内容
      expect(MessageTypeManager.isValidMessageContent('Hello')).toBe(true);

      // 有效的工具调用
      const validToolCall = {
        type: MessageType.TOOL_CALL,
        id: 'call-1',
        name: 'test_function',
        arguments: '{"param": "value"}'
      };
      expect(MessageTypeManager.isValidMessageContent(validToolCall)).toBe(true);

      // 无效的内容
      expect(MessageTypeManager.isValidMessageContent(null)).toBe(false);
      expect(MessageTypeManager.isValidMessageContent({})).toBe(false);
      expect(MessageTypeManager.isValidMessageContent({ type: 'unknown_type' })).toBe(false);
    });
  });

  describe('toDisplayMessage', () => {
    test('应正确转换文本消息', () => {
      const dbMessage: DatabaseMessage = {
        id: 'msg-1',
        content: '你好，世界！',
        role: 'user',
        created_at: '2023-01-01T00:00:00Z',
        user_id: userId,
        thread_id: threadId,
        is_visible: true,
        send_to_llm: true
      };

      const result = MessageTypeManager.toDisplayMessage(dbMessage);

      expect(result).toEqual({
        id: 'msg-1',
        content: '你好，世界！',
        role: 'user',
        created_at: '2023-01-01T00:00:00Z',
        user_id: userId,
        metadata: undefined
      });
    });

    test('应正确转换JSON格式的工具调用消息', () => {
      const toolCallContent = {
        type: MessageType.TOOL_CALL,
        id: 'call-1',
        name: 'test_function',
        arguments: '{"param": "value"}'
      };

      const dbMessage: DatabaseMessage = {
        id: 'msg-2',
        content: JSON.stringify(toolCallContent),
        role: 'assistant',
        created_at: '2023-01-01T00:00:00Z',
        user_id: userId,
        thread_id: threadId,
        is_visible: true,
        send_to_llm: true
      };

      const result = MessageTypeManager.toDisplayMessage(dbMessage);

      expect(result).toEqual({
        id: 'msg-2',
        content: toolCallContent,
        role: 'assistant',
        created_at: '2023-01-01T00:00:00Z',
        user_id: userId,
        metadata: undefined
      });
    });

    test('应优雅处理无效的JSON', () => {
      const dbMessage: DatabaseMessage = {
        id: 'msg-3',
        content: '{这不是有效的JSON}',
        role: 'assistant',
        created_at: '2023-01-01T00:00:00Z',
        user_id: userId,
        thread_id: threadId,
        is_visible: true,
        send_to_llm: true
      };

      const result = MessageTypeManager.toDisplayMessage(dbMessage);

      expect(result.content).toEqual({
        type: MessageType.ERROR,
        message: 'JSON解析失败: 无效的JSON格式',
        originalContent: '{这不是有效的JSON}'
      });
    });

    test('应处理非JSON格式的assistant消息', () => {
      const dbMessage: DatabaseMessage = {
        id: 'msg-4',
        content: '这是纯文本消息',
        role: 'assistant',
        created_at: '2023-01-01T00:00:00Z',
        user_id: userId,
        thread_id: threadId,
        is_visible: true,
        send_to_llm: true
      };

      const result = MessageTypeManager.toDisplayMessage(dbMessage);

      expect(result.content).toEqual('这是纯文本消息');
    });
  });

  describe('toLLMHistoryMessage', () => {
    test('应正确转换用户消息', () => {
      const dbMessage: DatabaseMessage = {
        id: 'msg-1',
        content: '你好，世界！',
        role: 'user',
        created_at: '2023-01-01T00:00:00Z',
        user_id: userId,
        thread_id: threadId,
        is_visible: true,
        send_to_llm: true
      };

      const result = MessageTypeManager.toLLMHistoryMessage(dbMessage);

      expect(result).toEqual({
        role: 'user',
        content: '你好，世界！'
      });
    });

    test('应正确转换工具角色消息', () => {
      const dbMessage: DatabaseMessage = {
        id: 'msg-2',
        content: '{"result": "操作成功"}',
        role: 'tool',
        created_at: '2023-01-01T00:00:00Z',
        user_id: userId,
        thread_id: threadId,
        is_visible: true,
        send_to_llm: true,
        tool_call_id: toolCallId
      };

      const result = MessageTypeManager.toLLMHistoryMessage(dbMessage);

      expect(result).toEqual({
        role: 'tool',
        content: '{"result": "操作成功"}',
        tool_call_id: toolCallId
      });
    });

    test('应正确转换包含工具调用的助手消息', () => {
      const toolCallContent = {
        type: MessageType.TOOL_CALL,
        id: 'call-1',
        name: 'test_function',
        arguments: '{"param": "value"}'
      };

      const dbMessage: DatabaseMessage = {
        id: 'msg-3',
        content: JSON.stringify(toolCallContent),
        role: 'assistant',
        created_at: '2023-01-01T00:00:00Z',
        user_id: userId,
        thread_id: threadId,
        is_visible: true,
        send_to_llm: true
      };

      const result = MessageTypeManager.toLLMHistoryMessage(dbMessage);

      expect(result).toEqual({
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call-1',
            type: 'function',
            function: {
              name: 'test_function',
              arguments: '{"param": "value"}'
            }
          }
        ]
      });
    });

    test('应正确转换包含多个工具调用的助手消息', () => {
      const toolCallsContent = {
        type: MessageType.TOOL_CALLS,
        tool_calls: [
          {
            id: 'call-1',
            type: 'function',
            function: {
              name: 'test_function1',
              arguments: '{"param": "value1"}'
            }
          },
          {
            id: 'call-2',
            type: 'function',
            function: {
              name: 'test_function2',
              arguments: '{"param": "value2"}'
            }
          }
        ]
      };

      const dbMessage: DatabaseMessage = {
        id: 'msg-4',
        content: JSON.stringify(toolCallsContent),
        role: 'assistant',
        created_at: '2023-01-01T00:00:00Z',
        user_id: userId,
        thread_id: threadId,
        is_visible: true,
        send_to_llm: true
      };

      const result = MessageTypeManager.toLLMHistoryMessage(dbMessage);

      expect(result).toEqual({
        role: 'assistant',
        content: null,
        tool_calls: toolCallsContent.tool_calls
      });
    });
  });

  describe('createDatabaseMessage', () => {
    test('应正确创建文本消息', () => {
      const result = MessageTypeManager.createDatabaseMessage({
        content: '你好，世界！',
        role: 'user',
        userId,
        threadId
      });

      expect(result).toEqual({
        content: '你好，世界！',
        role: 'user',
        user_id: userId,
        thread_id: threadId,
        is_visible: true,
        send_to_llm: true,
        tool_call_id: undefined,
        sequence: undefined,
        metadata: undefined
      });
    });

    test('应正确创建对象消息', () => {
      const content = {
        type: MessageType.TOOL_CALL,
        id: 'call-1',
        name: 'test_function',
        arguments: '{"param": "value"}'
      };

      const result = MessageTypeManager.createDatabaseMessage({
        content,
        role: 'assistant',
        userId,
        threadId
      });

      expect(result).toEqual({
        content: JSON.stringify(content),
        role: 'assistant',
        user_id: userId,
        thread_id: threadId,
        is_visible: true,
        send_to_llm: true,
        tool_call_id: undefined,
        sequence: undefined,
        metadata: undefined
      });
    });

    test('应正确设置可选参数', () => {
      const result = MessageTypeManager.createDatabaseMessage({
        content: '系统消息',
        role: 'system',
        userId,
        threadId,
        isVisible: false,
        sendToLLM: true,
        toolCallId,
        sequence: 1,
        metadata: { key: 'value' }
      });

      expect(result).toEqual({
        content: '系统消息',
        role: 'system',
        user_id: userId,
        thread_id: threadId,
        is_visible: false,
        send_to_llm: true,
        tool_call_id: toolCallId,
        sequence: 1,
        metadata: { key: 'value' }
      });
    });
  });
});
