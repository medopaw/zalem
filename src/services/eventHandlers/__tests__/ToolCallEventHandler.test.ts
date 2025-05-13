import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { ToolCallEventHandler, createToolCallEventHandler } from '../ToolCallEventHandler';
import { IMessageRepository } from '../../../repositories/IMessageRepository';
import { MessageEventType, ToolCallEventData } from '../../../types/messaging';
import { getMessageEventBus } from '../../messaging/MessageEventBus';
import { getToolCallProcessorRegistry } from '../../messaging/ToolCallProcessorRegistry';

// 模拟依赖
vi.mock('../../messaging/MessageEventBus', () => ({
  getMessageEventBus: vi.fn()
}));

vi.mock('../../messaging/ToolCallProcessorRegistry', () => ({
  getToolCallProcessorRegistry: vi.fn()
}));

describe('ToolCallEventHandler', () => {
  // 创建模拟对象
  const mockMessageRepository: IMessageRepository = {
    getMessages: vi.fn(),
    saveMessage: vi.fn(),
    getLLMHistoryMessages: vi.fn(),
    clearMessages: vi.fn(),
    createWelcomeMessage: vi.fn()
  };

  const mockEventBus = {
    publish: vi.fn(),
    subscribe: vi.fn(),
    subscribeAll: vi.fn()
  };

  const mockToolProcessor = {
    canProcess: vi.fn(),
    processToolCall: vi.fn()
  };

  const mockToolProcessorRegistry = {
    registerProcessor: vi.fn(),
    getProcessor: vi.fn(),
    getAllProcessors: vi.fn()
  };

  // 在每个测试前重置模拟
  beforeEach(() => {
    vi.clearAllMocks();

    // 设置模拟返回值
    (getMessageEventBus as any).mockReturnValue(mockEventBus);
    (getToolCallProcessorRegistry as any).mockReturnValue(mockToolProcessorRegistry);

    // 设置订阅函数的模拟实现
    mockEventBus.subscribe.mockImplementation(() => {
      return () => {}; // 返回取消订阅函数
    });

    // 保存全局对象的原始状态
    global.window = global.window || {};
  });

  // 在每个测试后清理
  afterEach(() => {
    // 清理可能添加到全局对象的属性
    if (global.window) {
      delete (global.window as any).__toolCallHandler;
    }
  });

  test('should create handler and subscribe to events', () => {
    // 创建处理器
    createToolCallEventHandler(mockMessageRepository);

    // 验证事件订阅
    expect(mockEventBus.subscribe).toHaveBeenCalledTimes(1);
    expect(mockEventBus.subscribe).toHaveBeenCalledWith(
      MessageEventType.TOOL_CALL_RECEIVED,
      expect.any(Function)
    );

    // 注意：在实际代码中，处理器可能被保存到全局对象，但在测试中我们不验证这一点
    // 因为这是实现细节，可能会改变
  });

  test('should process tool call and publish result', async () => {
    // 创建处理器
    createToolCallEventHandler(mockMessageRepository);

    // 获取订阅的事件处理函数
    const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

    // 设置工具处理器的模拟实现
    mockToolProcessorRegistry.getProcessor.mockReturnValue(mockToolProcessor);
    mockToolProcessor.processToolCall.mockResolvedValue({
      toolCallId: 'tool-call-1',
      status: 'success',
      result: { test: true },
      message: '操作成功'
    });

    // 创建工具调用事件
    const event = {
      type: MessageEventType.TOOL_CALL_RECEIVED,
      data: {
        threadId: 'thread-1',
        userId: 'user-1',
        toolCall: {
          id: 'tool-call-1',
          name: 'test_tool',
          arguments: { param: 'value' }
        },
        messageId: 'message-1'
      } as ToolCallEventData
    };

    // 调用事件处理函数
    await eventHandler(event);

    // 验证工具处理器被调用
    expect(mockToolProcessorRegistry.getProcessor).toHaveBeenCalledWith('test_tool');
    expect(mockToolProcessor.processToolCall).toHaveBeenCalledWith(
      event.data.toolCall,
      'thread-1',
      'user-1'
    );

    // 验证工具调用结果事件被发布
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).toHaveBeenCalledWith({
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
        messageId: ''
      }
    });
  });

  test('should handle missing tool processor', async () => {
    // 创建处理器
    createToolCallEventHandler(mockMessageRepository);

    // 获取订阅的事件处理函数
    const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

    // 设置工具处理器注册表返回 undefined
    mockToolProcessorRegistry.getProcessor.mockReturnValue(undefined);

    // 创建工具调用事件
    const event = {
      type: MessageEventType.TOOL_CALL_RECEIVED,
      data: {
        threadId: 'thread-1',
        userId: 'user-1',
        toolCall: {
          id: 'tool-call-1',
          name: 'unknown_tool',
          arguments: { param: 'value' }
        },
        messageId: 'message-1'
      } as ToolCallEventData
    };

    // 调用事件处理函数
    await eventHandler(event);

    // 验证工具处理器被查找
    expect(mockToolProcessorRegistry.getProcessor).toHaveBeenCalledWith('unknown_tool');

    // 验证错误结果事件被发布
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).toHaveBeenCalledWith({
      type: MessageEventType.TOOL_RESULT_SENT,
      data: {
        threadId: 'thread-1',
        userId: 'user-1',
        toolResult: {
          toolCallId: 'tool-call-1',
          status: 'error',
          result: null,
          message: expect.stringContaining('未找到工具处理器')
        },
        messageId: ''
      }
    });
  });

  test('should handle processor error', async () => {
    // 创建处理器
    createToolCallEventHandler(mockMessageRepository);

    // 获取订阅的事件处理函数
    const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

    // 设置工具处理器抛出错误
    mockToolProcessorRegistry.getProcessor.mockReturnValue(mockToolProcessor);
    mockToolProcessor.processToolCall.mockRejectedValue(new Error('处理失败'));

    // 创建工具调用事件
    const event = {
      type: MessageEventType.TOOL_CALL_RECEIVED,
      data: {
        threadId: 'thread-1',
        userId: 'user-1',
        toolCall: {
          id: 'tool-call-1',
          name: 'test_tool',
          arguments: { param: 'value' }
        },
        messageId: 'message-1'
      } as ToolCallEventData
    };

    // 调用事件处理函数
    await eventHandler(event);

    // 验证错误结果事件被发布
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).toHaveBeenCalledWith({
      type: MessageEventType.TOOL_RESULT_SENT,
      data: {
        threadId: 'thread-1',
        userId: 'user-1',
        toolResult: {
          toolCallId: 'tool-call-1',
          status: 'error',
          result: null,
          message: expect.stringContaining('处理失败')
        },
        messageId: ''
      }
    });
  });
});
