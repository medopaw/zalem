import { describe, test, expect, beforeEach, vi } from 'vitest';
import { EventHandlerRegistry } from '../EventHandlerRegistry';
import { MessageEventType, MessageEvent } from '../../../types/messaging';
import { IMessageEventBus } from '../../../types/messaging';

describe('EventHandlerRegistry', () => {
  // 创建模拟的事件总线
  const mockEventBus: IMessageEventBus = {
    publish: vi.fn(),
    subscribe: vi.fn(),
    subscribeAll: vi.fn(),
    getListenerCount: vi.fn()
  };

  // 在每个测试前重置模拟
  beforeEach(() => {
    vi.clearAllMocks();
    
    // 设置默认的模拟实现
    (mockEventBus.subscribe as any).mockImplementation((eventType, handler) => {
      return () => {}; // 返回一个取消订阅的函数
    });
    
    (mockEventBus.getListenerCount as any).mockImplementation((eventType) => {
      return 1; // 默认返回1个监听器
    });
  });

  test('should create registry with event bus', () => {
    const registry = new EventHandlerRegistry(mockEventBus);
    expect(registry).toBeDefined();
  });

  test('registerHandler should subscribe to event bus', () => {
    const registry = new EventHandlerRegistry(mockEventBus);
    const handler = vi.fn();
    
    registry.registerHandler(MessageEventType.TOOL_RESULT_SENT, handler);
    
    expect(mockEventBus.subscribe).toHaveBeenCalledTimes(1);
    expect(mockEventBus.subscribe).toHaveBeenCalledWith(
      MessageEventType.TOOL_RESULT_SENT,
      handler
    );
  });

  test('registerHandler should return unsubscribe function', () => {
    const registry = new EventHandlerRegistry(mockEventBus);
    const handler = vi.fn();
    const mockUnsubscribe = vi.fn();
    
    // 设置模拟实现，返回我们的模拟取消订阅函数
    (mockEventBus.subscribe as any).mockImplementation((eventType, handler) => {
      return mockUnsubscribe;
    });
    
    const unsubscribe = registry.registerHandler(MessageEventType.TOOL_RESULT_SENT, handler);
    
    // 调用返回的取消订阅函数
    unsubscribe();
    
    // 验证我们的模拟取消订阅函数被调用
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  test('getHandlerCount should return count from event bus', () => {
    const registry = new EventHandlerRegistry(mockEventBus);
    
    // 设置模拟实现，返回特定的监听器数量
    (mockEventBus.getListenerCount as any).mockImplementation((eventType) => {
      if (eventType === MessageEventType.TOOL_RESULT_SENT) {
        return 3;
      }
      return 0;
    });
    
    const count = registry.getHandlerCount(MessageEventType.TOOL_RESULT_SENT);
    
    expect(count).toBe(3);
    expect(mockEventBus.getListenerCount).toHaveBeenCalledTimes(1);
    expect(mockEventBus.getListenerCount).toHaveBeenCalledWith(MessageEventType.TOOL_RESULT_SENT);
  });

  test('getHandlerCount should return -1 if getListenerCount is not available', () => {
    const registry = new EventHandlerRegistry({
      ...mockEventBus,
      getListenerCount: undefined as any
    });
    
    const count = registry.getHandlerCount(MessageEventType.TOOL_RESULT_SENT);
    
    expect(count).toBe(-1);
  });

  test('initializeAllHandlers should be implemented by subclasses', () => {
    const registry = new EventHandlerRegistry(mockEventBus);
    
    // 基类的实现应该只是记录日志，不做其他操作
    expect(() => registry.initializeAllHandlers()).not.toThrow();
  });

  test('multiple handlers can be registered for the same event type', () => {
    const registry = new EventHandlerRegistry(mockEventBus);
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    
    registry.registerHandler(MessageEventType.TOOL_RESULT_SENT, handler1);
    registry.registerHandler(MessageEventType.TOOL_RESULT_SENT, handler2);
    
    expect(mockEventBus.subscribe).toHaveBeenCalledTimes(2);
    expect(mockEventBus.subscribe).toHaveBeenCalledWith(
      MessageEventType.TOOL_RESULT_SENT,
      handler1
    );
    expect(mockEventBus.subscribe).toHaveBeenCalledWith(
      MessageEventType.TOOL_RESULT_SENT,
      handler2
    );
  });

  test('handlers for different event types can be registered', () => {
    const registry = new EventHandlerRegistry(mockEventBus);
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    
    registry.registerHandler(MessageEventType.TOOL_RESULT_SENT, handler1);
    registry.registerHandler(MessageEventType.USER_MESSAGE_SENT, handler2);
    
    expect(mockEventBus.subscribe).toHaveBeenCalledTimes(2);
    expect(mockEventBus.subscribe).toHaveBeenCalledWith(
      MessageEventType.TOOL_RESULT_SENT,
      handler1
    );
    expect(mockEventBus.subscribe).toHaveBeenCalledWith(
      MessageEventType.USER_MESSAGE_SENT,
      handler2
    );
  });
});
