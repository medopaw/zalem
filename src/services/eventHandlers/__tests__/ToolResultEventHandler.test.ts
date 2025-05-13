import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { ToolResultEventHandler, createToolResultEventHandler } from '../ToolResultEventHandler';
import { IMessageRepository } from '../../../repositories/IMessageRepository';
import { AIService } from '../../ai/AIService';
import { MessageEventType } from '../../../types/messaging';
import { getMessageEventBus } from '../../messaging/MessageEventBus';
import { getErrorReporter } from '../../error/ErrorReporter';

// 模拟依赖
vi.mock('../../messaging/MessageEventBus', () => ({
  getMessageEventBus: vi.fn()
}));

// 模拟错误报告器，包括 ErrorLevel 枚举
vi.mock('../../error/ErrorReporter', () => ({
  getErrorReporter: vi.fn(),
  ErrorLevel: {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical'
  }
}));

vi.mock('../../../utils/logger', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

describe('ToolResultEventHandler', () => {
  // 创建模拟对象
  const mockMessageRepository: IMessageRepository = {
    getMessages: vi.fn(),
    saveMessage: vi.fn(),
    getLLMHistoryMessages: vi.fn(),
    clearMessages: vi.fn(),
    createWelcomeMessage: vi.fn()
  };

  const mockAIService: Partial<AIService> = {
    sendMessage: vi.fn()
  };

  const mockEventBus = {
    publish: vi.fn(),
    subscribe: vi.fn(),
    subscribeAll: vi.fn(),
    hasListeners: vi.fn(),
    getListenerCount: vi.fn(),
    getRegisteredEventTypes: vi.fn()
  };

  const mockErrorReporter = {
    reportToUI: vi.fn(),
    reportToConsole: vi.fn()
  };

  // 在每个测试前重置模拟
  beforeEach(() => {
    vi.clearAllMocks();

    // 设置模拟返回值
    (getMessageEventBus as any).mockReturnValue(mockEventBus);
    (getErrorReporter as any).mockReturnValue(mockErrorReporter);

    // 设置订阅函数的模拟实现
    mockEventBus.subscribe.mockImplementation(() => {
      return () => {}; // 返回取消订阅函数
    });

    mockEventBus.subscribeAll.mockImplementation(() => {
      return () => {}; // 返回取消订阅函数
    });

    // 设置事件总线状态检查函数
    mockEventBus.hasListeners.mockReturnValue(true);
    mockEventBus.getListenerCount.mockReturnValue(1);
    mockEventBus.getRegisteredEventTypes.mockReturnValue([MessageEventType.TOOL_RESULT_SENT]);

    // 保存全局对象的原始状态
    global.window = global.window || {};
    global.console = global.console || { error: vi.fn() };
  });

  // 在每个测试后清理
  afterEach(() => {
    // 清理可能添加到全局对象的属性
    if (global.window) {
      delete (global.window as any).__toolResultEventHandler;
      delete (global.window as any).__toolResultEventHandlerFn;
      delete (global.window as any).__toolResultEventHandlerUnsubscribe;
      delete (global.window as any).__toolResultEventHandlerGlobalUnsubscribe;
      delete (global.window as any).testToolResultEvent;
    }
  });

  test('should create handler and subscribe to events', () => {
    // 重置模拟
    vi.clearAllMocks();

    // 设置事件总线状态检查函数
    mockEventBus.hasListeners.mockReturnValue(true);
    mockEventBus.getListenerCount.mockReturnValue(1);
    mockEventBus.getRegisteredEventTypes.mockReturnValue([MessageEventType.TOOL_RESULT_SENT]);

    // 创建处理器
    createToolResultEventHandler(
      mockMessageRepository,
      mockAIService as AIService
    );

    // 验证事件订阅
    expect(mockEventBus.subscribe).toHaveBeenCalledTimes(1);
    expect(mockEventBus.subscribe).toHaveBeenCalledWith(
      MessageEventType.TOOL_RESULT_SENT,
      expect.any(Function)
    );

    // 验证全局事件订阅
    expect(mockEventBus.subscribeAll).toHaveBeenCalledTimes(1);
  });

  test('should process tool result and send to LLM', async () => {
    // 创建处理器
    createToolResultEventHandler(
      mockMessageRepository,
      mockAIService as AIService
    );

    // 获取订阅的事件处理函数
    const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

    // 设置模拟返回值
    mockMessageRepository.getMessages.mockResolvedValue({
      messages: [
        {
          id: 'message-1',
          content: '{"type":"tool_result","tool_call_id":"tool-call-1","status":"success","message":"操作成功"}',
          role: 'tool',
          created_at: '2023-01-01T00:00:00Z',
          user_id: 'user-1',
          thread_id: 'thread-1',
          is_visible: true,
          send_to_llm: true,
          tool_call_id: 'tool-call-1'
        }
      ],
      error: null
    });

    mockMessageRepository.getLLMHistoryMessages.mockResolvedValue({
      messages: [
        {
          role: 'tool',
          content: '操作成功',
          tool_call_id: 'tool-call-1'
        }
      ],
      error: null
    });

    mockAIService.sendMessage.mockResolvedValue({
      role: 'assistant',
      content: '我已经处理了你的请求'
    });

    mockMessageRepository.saveMessage.mockResolvedValue({
      id: 'message-2',
      content: '我已经处理了你的请求',
      role: 'assistant',
      created_at: '2023-01-01T00:00:01Z',
      user_id: 'user-1',
      thread_id: 'thread-1',
      is_visible: true,
      send_to_llm: true
    });

    // 创建工具调用结果事件
    const event = {
      type: MessageEventType.TOOL_RESULT_SENT,
      data: {
        threadId: 'thread-1',
        userId: 'user-1',
        toolResult: {
          toolCallId: 'tool-call-1',
          status: 'success',
          result: { test: true },
          message: '操作成功'
        },
        messageId: 'message-1'
      }
    };

    // 调用事件处理函数
    await eventHandler(event);

    // 验证获取消息历史
    expect(mockMessageRepository.getMessages).toHaveBeenCalledWith('thread-1', {
      includeHidden: true,
      forLLM: true
    });

    expect(mockMessageRepository.getLLMHistoryMessages).toHaveBeenCalledWith('thread-1');

    // 验证发送消息给大模型
    expect(mockAIService.sendMessage).toHaveBeenCalled();

    // 验证保存大模型响应
    expect(mockMessageRepository.saveMessage).toHaveBeenCalledWith(
      '我已经处理了你的请求',
      'assistant',
      'user-1',
      'thread-1'
    );

    // 验证发布助手消息事件
    expect(mockEventBus.publish).toHaveBeenCalledWith({
      type: MessageEventType.ASSISTANT_MESSAGE_RECEIVED,
      data: {
        threadId: 'thread-1',
        userId: 'user-1',
        messageId: 'message-2',
        content: '我已经处理了你的请求'
      }
    });
  });

  test('should handle missing tool result message', async () => {
    // 重置模拟
    vi.clearAllMocks();

    // 创建处理器
    createToolResultEventHandler(
      mockMessageRepository,
      mockAIService as AIService
    );

    // 获取订阅的事件处理函数
    const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

    // 设置模拟返回值 - 没有找到工具调用结果消息
    mockMessageRepository.getMessages.mockResolvedValue({
      messages: [],
      error: null
    });

    // 模拟保存消息
    mockMessageRepository.saveMessage.mockResolvedValue({
      id: 'message-new',
      content: '{"type":"tool_result","tool_call_id":"tool-call-1","status":"success","message":"操作成功"}',
      role: 'tool',
      created_at: '2023-01-01T00:00:00Z',
      user_id: 'user-1',
      thread_id: 'thread-1',
      is_visible: true,
      send_to_llm: true,
      tool_call_id: 'tool-call-1'
    });

    // 创建工具调用结果事件
    const event = {
      type: MessageEventType.TOOL_RESULT_SENT,
      data: {
        threadId: 'thread-1',
        userId: 'user-1',
        toolResult: {
          toolCallId: 'tool-call-1',
          status: 'success',
          result: { test: true },
          message: '操作成功'
        },
        messageId: 'message-1'
      }
    };

    // 调用事件处理函数
    await eventHandler(event);

    // 验证尝试保存工具调用结果消息
    expect(mockMessageRepository.saveMessage).toHaveBeenCalled();
  });

  test('should handle LLM error', async () => {
    // 重置模拟
    vi.clearAllMocks();

    // 创建处理器
    createToolResultEventHandler(
      mockMessageRepository,
      mockAIService as AIService
    );

    // 获取订阅的事件处理函数
    const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

    // 设置模拟返回值
    mockMessageRepository.getMessages.mockResolvedValue({
      messages: [
        {
          id: 'message-1',
          content: '{"type":"tool_result","tool_call_id":"tool-call-1","status":"success","message":"操作成功"}',
          role: 'tool',
          created_at: '2023-01-01T00:00:00Z',
          user_id: 'user-1',
          thread_id: 'thread-1',
          is_visible: true,
          send_to_llm: true,
          tool_call_id: 'tool-call-1'
        }
      ],
      error: null
    });

    mockMessageRepository.getLLMHistoryMessages.mockResolvedValue({
      messages: [
        {
          role: 'tool',
          content: '操作成功',
          tool_call_id: 'tool-call-1'
        }
      ],
      error: null
    });

    // 模拟大模型返回错误
    mockAIService.sendMessage.mockRejectedValue(new Error('LLM调用失败'));

    // 创建工具调用结果事件
    const event = {
      type: MessageEventType.TOOL_RESULT_SENT,
      data: {
        threadId: 'thread-1',
        userId: 'user-1',
        toolResult: {
          toolCallId: 'tool-call-1',
          status: 'success',
          result: { test: true },
          message: '操作成功'
        },
        messageId: 'message-1'
      }
    };

    // 调用事件处理函数
    await eventHandler(event);

    // 验证发送消息给大模型失败
    expect(mockAIService.sendMessage).toHaveBeenCalled();
  });


});
