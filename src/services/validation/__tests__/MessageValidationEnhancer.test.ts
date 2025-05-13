import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  withContentValidation,
  withDatabaseMessageValidation,
  withDisplayMessageValidation,
  withLLMHistoryMessageValidation,
  withToolCallArgumentsValidation,
  withToolResultValidation
} from '../MessageValidationEnhancer';
import { MessageType } from '../../../utils/MessageTypeManager';
import { getMessageValidator, resetMessageValidator } from '../MessageValidatorProvider';

// 模拟依赖
vi.mock('../MessageValidatorProvider', () => ({
  getMessageValidator: vi.fn(),
  resetMessageValidator: vi.fn()
}));

vi.mock('../../logging/MessageLogger', () => ({
  MessageLogger: {
    logMessageContent: vi.fn(),
    logDatabaseMessage: vi.fn(),
    logDisplayMessage: vi.fn(),
    logLLMHistoryMessage: vi.fn()
  }
}));

vi.mock('../../../utils/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn()
  }
}));

describe('MessageValidationEnhancer', () => {
  // 创建模拟的验证器
  const mockValidator = {
    validateMessageContent: vi.fn(),
    validateDatabaseMessage: vi.fn(),
    validateDisplayMessage: vi.fn(),
    validateLLMHistoryMessage: vi.fn(),
    validateToolCallArguments: vi.fn(),
    validateToolResult: vi.fn(),
    reportValidationError: vi.fn()
  };

  // 在每个测试前重置模拟
  beforeEach(() => {
    vi.clearAllMocks();
    
    // 设置模拟验证器
    (getMessageValidator as any).mockReturnValue(mockValidator);
    
    // 设置默认的验证结果
    mockValidator.validateMessageContent.mockReturnValue({ isValid: true, data: 'test content' });
    mockValidator.validateDatabaseMessage.mockReturnValue({ isValid: true, data: { id: 'msg-1' } });
    mockValidator.validateDisplayMessage.mockReturnValue({ isValid: true, data: { id: 'msg-1' } });
    mockValidator.validateLLMHistoryMessage.mockReturnValue({ isValid: true, data: { role: 'user' } });
    mockValidator.validateToolCallArguments.mockReturnValue({ isValid: true, data: { param: 'value' } });
    mockValidator.validateToolResult.mockReturnValue({ isValid: true, data: { status: 'success' } });
  });

  // 在每个测试后清理
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('withContentValidation', () => {
    test('应该在验证通过时调用原始处理函数', () => {
      // 创建模拟的处理函数
      const mockProcessor = vi.fn().mockReturnValue('processed content');
      
      // 创建增强后的处理函数
      const enhancedProcessor = withContentValidation(mockProcessor, 'test_context');
      
      // 调用增强后的处理函数
      const result = enhancedProcessor('test content');
      
      // 验证原始处理函数被调用
      expect(mockProcessor).toHaveBeenCalledTimes(1);
      expect(mockProcessor).toHaveBeenCalledWith('test content');
      
      // 验证返回结果
      expect(result).toBe('processed content');
    });

    test('应该在验证失败时抛出错误', () => {
      // 设置验证失败
      mockValidator.validateMessageContent.mockReturnValue({
        isValid: false,
        error: {
          message: '验证错误',
          details: '错误详情'
        }
      });
      
      // 创建模拟的处理函数
      const mockProcessor = vi.fn();
      
      // 创建增强后的处理函数
      const enhancedProcessor = withContentValidation(mockProcessor, 'test_context');
      
      // 调用增强后的处理函数应该抛出错误
      expect(() => enhancedProcessor('test content')).toThrow('验证错误');
      
      // 验证原始处理函数没有被调用
      expect(mockProcessor).not.toHaveBeenCalled();
      
      // 验证错误被报告
      expect(mockValidator.reportValidationError).toHaveBeenCalledTimes(1);
    });

    test('应该处理原始处理函数抛出的错误', () => {
      // 创建抛出错误的模拟处理函数
      const mockProcessor = vi.fn().mockImplementation(() => {
        throw new Error('处理错误');
      });
      
      // 创建增强后的处理函数
      const enhancedProcessor = withContentValidation(mockProcessor, 'test_context');
      
      // 调用增强后的处理函数应该抛出错误
      expect(() => enhancedProcessor('test content')).toThrow('处理错误');
    });
  });

  describe('withDatabaseMessageValidation', () => {
    test('应该在验证通过时调用原始处理函数', () => {
      // 创建模拟的数据库消息
      const dbMessage = {
        id: 'msg-1',
        content: 'test content',
        role: 'user',
        created_at: '2023-01-01T00:00:00Z',
        user_id: 'user-1',
        thread_id: 'thread-1'
      };
      
      // 创建模拟的处理函数
      const mockProcessor = vi.fn().mockReturnValue('processed message');
      
      // 创建增强后的处理函数
      const enhancedProcessor = withDatabaseMessageValidation(mockProcessor, 'test_context');
      
      // 调用增强后的处理函数
      const result = enhancedProcessor(dbMessage as any);
      
      // 验证原始处理函数被调用
      expect(mockProcessor).toHaveBeenCalledTimes(1);
      expect(mockProcessor).toHaveBeenCalledWith(dbMessage);
      
      // 验证返回结果
      expect(result).toBe('processed message');
    });
  });

  describe('withToolCallArgumentsValidation', () => {
    test('应该在验证通过时调用原始处理函数', () => {
      // 创建模拟的工具调用参数
      const args = { nickname: '新昵称' };
      
      // 创建模拟的处理函数
      const mockProcessor = vi.fn().mockReturnValue('processed args');
      
      // 创建增强后的处理函数
      const enhancedProcessor = withToolCallArgumentsValidation('set_nickname', mockProcessor, 'test_context');
      
      // 调用增强后的处理函数
      const result = enhancedProcessor(args);
      
      // 验证原始处理函数被调用
      expect(mockProcessor).toHaveBeenCalledTimes(1);
      expect(mockProcessor).toHaveBeenCalledWith(args);
      
      // 验证返回结果
      expect(result).toBe('processed args');
    });

    test('应该在验证失败时抛出错误', () => {
      // 设置验证失败
      mockValidator.validateToolCallArguments.mockReturnValue({
        isValid: false,
        error: {
          message: '验证错误',
          details: '错误详情'
        }
      });
      
      // 创建模拟的处理函数
      const mockProcessor = vi.fn();
      
      // 创建增强后的处理函数
      const enhancedProcessor = withToolCallArgumentsValidation('set_nickname', mockProcessor, 'test_context');
      
      // 调用增强后的处理函数应该抛出错误
      expect(() => enhancedProcessor({ invalid: 'args' })).toThrow('验证错误');
      
      // 验证原始处理函数没有被调用
      expect(mockProcessor).not.toHaveBeenCalled();
      
      // 验证错误被报告
      expect(mockValidator.reportValidationError).toHaveBeenCalledTimes(1);
    });
  });

  describe('withToolResultValidation', () => {
    test('应该在验证通过时调用原始处理函数', () => {
      // 创建模拟的工具调用结果
      const toolResult = {
        toolCallId: 'call-1',
        status: 'success',
        message: '操作成功'
      };
      
      // 创建模拟的处理函数
      const mockProcessor = vi.fn().mockReturnValue('processed result');
      
      // 创建增强后的处理函数
      const enhancedProcessor = withToolResultValidation(mockProcessor, 'test_context');
      
      // 调用增强后的处理函数
      const result = enhancedProcessor(toolResult);
      
      // 验证原始处理函数被调用
      expect(mockProcessor).toHaveBeenCalledTimes(1);
      expect(mockProcessor).toHaveBeenCalledWith(toolResult);
      
      // 验证返回结果
      expect(result).toBe('processed result');
    });
  });
});
