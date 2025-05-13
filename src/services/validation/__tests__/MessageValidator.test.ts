import { describe, test, expect, beforeEach, vi } from 'vitest';
import { MessageValidator } from '../MessageValidator';
import { IErrorReporter, ErrorLevel } from '../../error/ErrorReporter';
import { MessageType } from '../../../utils/MessageTypeManager';

describe('MessageValidator', () => {
  // 创建模拟的错误报告服务
  const mockErrorReporter: IErrorReporter = {
    report: vi.fn(),
    reportToUI: vi.fn(),
    addListener: vi.fn(),
    getUnDisplayedReports: vi.fn(),
    markAsDisplayed: vi.fn(),
    clearReports: vi.fn()
  };

  // 创建验证器实例
  let validator: MessageValidator;

  // 在每个测试前重置模拟
  beforeEach(() => {
    vi.clearAllMocks();
    validator = new MessageValidator(mockErrorReporter);
  });

  describe('validateMessageContent', () => {
    test('应该验证字符串内容为有效', () => {
      const result = validator.validateMessageContent('Hello, world!');
      expect(result.isValid).toBe(true);
      expect(result.data).toBe('Hello, world!');
    });

    test('应该验证非对象内容为无效', () => {
      const result = validator.validateMessageContent(123 as any);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('不是字符串或对象');
    });

    test('应该验证有效的工具调用内容', () => {
      const content = {
        type: MessageType.TOOL_CALL,
        id: 'call-1',
        name: 'test_function',
        arguments: '{"param": "value"}'
      };

      const result = validator.validateMessageContent(content);
      expect(result.isValid).toBe(true);
      expect(result.data).toBe(content);
    });

    test('应该验证无效的工具调用内容', () => {
      const content = {
        type: MessageType.TOOL_CALL,
        // 缺少必要字段
        name: 'test_function'
      };

      const result = validator.validateMessageContent(content);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('不符合任何已知类型');
    });
  });

  describe('validateDatabaseMessage', () => {
    test('应该验证有效的数据库消息', () => {
      const message = {
        id: 'msg-1',
        content: 'Hello, world!',
        role: 'user',
        created_at: '2023-01-01T00:00:00Z',
        user_id: 'user-1',
        thread_id: 'thread-1',
        is_visible: true,
        send_to_llm: true
      };

      const result = validator.validateDatabaseMessage(message);
      expect(result.isValid).toBe(true);
      expect(result.data).toBe(message);
    });

    test('应该验证缺少必要字段的数据库消息为无效', () => {
      const message = {
        id: 'msg-1',
        content: 'Hello, world!',
        role: 'user',
        // 缺少 created_at
        user_id: 'user-1',
        thread_id: 'thread-1'
      };

      const result = validator.validateDatabaseMessage(message);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('缺少必要字段');
      expect(result.error?.message).toContain('created_at');
    });

    test('应该验证角色无效的数据库消息为无效', () => {
      const message = {
        id: 'msg-1',
        content: 'Hello, world!',
        role: 'invalid_role', // 无效角色
        created_at: '2023-01-01T00:00:00Z',
        user_id: 'user-1',
        thread_id: 'thread-1',
        is_visible: true,
        send_to_llm: true
      };

      const result = validator.validateDatabaseMessage(message);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('角色');
      expect(result.error?.message).toContain('不是有效的角色');
    });
  });

  describe('validateDisplayMessage', () => {
    test('应该验证有效的显示消息', () => {
      const message = {
        id: 'msg-1',
        content: 'Hello, world!',
        role: 'user',
        created_at: '2023-01-01T00:00:00Z',
        user_id: 'user-1'
      };

      const result = validator.validateDisplayMessage(message);
      expect(result.isValid).toBe(true);
      expect(result.data).toBe(message);
    });

    test('应该验证带有对象内容的有效显示消息', () => {
      const message = {
        id: 'msg-1',
        content: {
          type: MessageType.TOOL_CALL,
          id: 'call-1',
          name: 'test_function',
          arguments: '{"param": "value"}'
        },
        role: 'assistant',
        created_at: '2023-01-01T00:00:00Z',
        user_id: 'user-1'
      };

      const result = validator.validateDisplayMessage(message);
      expect(result.isValid).toBe(true);
      expect(result.data).toBe(message);
    });

    test('应该验证内容无效的显示消息为无效', () => {
      const message = {
        id: 'msg-1',
        content: {
          type: 'invalid_type',
          data: 'some data'
        },
        role: 'assistant',
        created_at: '2023-01-01T00:00:00Z',
        user_id: 'user-1'
      };

      const result = validator.validateDisplayMessage(message);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('内容无效');
    });
  });

  describe('validateLLMHistoryMessage', () => {
    test('应该验证有效的LLM历史消息', () => {
      const message = {
        role: 'user',
        content: 'Hello, world!'
      };

      const result = validator.validateLLMHistoryMessage(message);
      expect(result.isValid).toBe(true);
      expect(result.data).toBe(message);
    });

    test('应该验证带有工具调用的助手消息', () => {
      const message = {
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
      };

      const result = validator.validateLLMHistoryMessage(message);
      expect(result.isValid).toBe(true);
      expect(result.data).toBe(message);
    });

    test('应该验证缺少content的助手消息为无效', () => {
      const message = {
        role: 'assistant',
        // 缺少 content
      };

      const result = validator.validateLLMHistoryMessage(message);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('缺少必要字段 content');
    });

    test('应该验证content为null但缺少tool_calls的助手消息为无效', () => {
      const message = {
        role: 'assistant',
        content: null
        // 缺少 tool_calls
      };

      const result = validator.validateLLMHistoryMessage(message);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('content为null时必须有tool_calls');
    });

    test('应该验证缺少tool_call_id的工具消息为无效', () => {
      const message = {
        role: 'tool',
        content: '操作成功'
        // 缺少 tool_call_id
      };

      const result = validator.validateLLMHistoryMessage(message);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('tool角色消息必须有tool_call_id');
    });
  });

  describe('validateToolCallArguments', () => {
    test('应该验证有效的set_nickname参数', () => {
      const args = {
        nickname: '新昵称'
      };

      const result = validator.validateToolCallArguments('set_nickname', args);
      expect(result.isValid).toBe(true);
      expect(result.data).toBe(args);
    });

    test('应该验证缺少nickname的set_nickname参数为无效', () => {
      const args = {
        // 缺少 nickname
        other: '其他参数'
      };

      const result = validator.validateToolCallArguments('set_nickname', args);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('缺少必要字段 nickname');
    });

    test('应该验证非对象参数为无效', () => {
      const result = validator.validateToolCallArguments('any_tool', 'not an object');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('不是对象');
    });
  });

  describe('validateToolResult', () => {
    test('应该验证有效的工具调用结果', () => {
      const result = {
        toolCallId: 'call-1',
        status: 'success',
        message: '操作成功',
        result: { data: 'some data' }
      };

      const validationResult = validator.validateToolResult(result);
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.data).toBe(result);
    });

    test('应该验证缺少必要字段的工具调用结果为无效', () => {
      const result = {
        toolCallId: 'call-1',
        status: 'success'
        // 缺少 message
      };

      const validationResult = validator.validateToolResult(result);
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.error).toBeDefined();
      expect(validationResult.error?.message).toContain('缺少必要字段');
      expect(validationResult.error?.message).toContain('message');
    });

    test('应该验证状态无效的工具调用结果为无效', () => {
      const result = {
        toolCallId: 'call-1',
        status: 'invalid_status', // 无效状态
        message: '操作成功'
      };

      const validationResult = validator.validateToolResult(result);
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.error).toBeDefined();
      expect(validationResult.error?.message).toContain('状态');
      expect(validationResult.error?.message).toContain('不是有效的状态');
    });
  });

  describe('reportValidationError', () => {
    test('应该报告验证错误', () => {
      const validationResult = {
        isValid: false,
        error: {
          message: '验证错误消息',
          details: '错误详情',
          originalContent: { some: 'data' }
        }
      };

      validator.reportValidationError(validationResult, 'test_context');

      expect(mockErrorReporter.reportToUI).toHaveBeenCalledTimes(1);
      expect(mockErrorReporter.reportToUI).toHaveBeenCalledWith({
        title: '消息格式错误',
        message: '验证错误消息',
        level: ErrorLevel.ERROR,
        details: '错误详情',
        context: 'test_context'
      });
    });

    test('不应该报告有效的验证结果', () => {
      const validationResult = {
        isValid: true,
        data: { some: 'data' }
      };

      validator.reportValidationError(validationResult, 'test_context');

      expect(mockErrorReporter.reportToUI).not.toHaveBeenCalled();
    });
  });
});
