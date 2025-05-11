import { describe, test, expect, beforeEach, vi } from 'vitest';
import { MessageEventBus, getMessageEventBus } from '../MessageEventBus';
import { MessageEventType, MessageEvent } from '../../../types/messaging';

describe('MessageEventBus', () => {
  let eventBus: MessageEventBus;

  beforeEach(() => {
    // 创建一个新的事件总线实例，避免测试之间的干扰
    eventBus = new MessageEventBus();
  });

  test('should subscribe to specific event type', () => {
    // 创建一个模拟的监听器函数
    const listener = vi.fn();

    // 订阅 USER_MESSAGE_SENT 事件
    eventBus.subscribe(MessageEventType.USER_MESSAGE_SENT, listener);

    // 创建一个事件
    const event: MessageEvent = {
      type: MessageEventType.USER_MESSAGE_SENT,
      data: {
        threadId: 'thread-1',
        userId: 'user-1',
        content: 'Hello',
        messageId: 'message-1'
      }
    };

    // 发布事件
    eventBus.publish(event);

    // 验证监听器被调用
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(event);
  });

  test('should not call listener for different event type', () => {
    // 创建一个模拟的监听器函数
    const listener = vi.fn();

    // 订阅 USER_MESSAGE_SENT 事件
    eventBus.subscribe(MessageEventType.USER_MESSAGE_SENT, listener);

    // 创建一个不同类型的事件
    const event: MessageEvent = {
      type: MessageEventType.ASSISTANT_MESSAGE_RECEIVED,
      data: {
        threadId: 'thread-1',
        userId: 'user-1',
        content: 'Hello',
        messageId: 'message-1'
      }
    };

    // 发布事件
    eventBus.publish(event);

    // 验证监听器没有被调用
    expect(listener).not.toHaveBeenCalled();
  });

  test('should subscribe to all events', () => {
    // 创建一个模拟的监听器函数
    const listener = vi.fn();

    // 订阅所有事件
    eventBus.subscribeAll(listener);

    // 创建多个不同类型的事件
    const event1: MessageEvent = {
      type: MessageEventType.USER_MESSAGE_SENT,
      data: {
        threadId: 'thread-1',
        userId: 'user-1',
        content: 'Hello',
        messageId: 'message-1'
      }
    };

    const event2: MessageEvent = {
      type: MessageEventType.ASSISTANT_MESSAGE_RECEIVED,
      data: {
        threadId: 'thread-1',
        userId: 'user-1',
        content: 'Hello back',
        messageId: 'message-2'
      }
    };

    // 发布事件
    eventBus.publish(event1);
    eventBus.publish(event2);

    // 验证监听器被调用两次
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledWith(event1);
    expect(listener).toHaveBeenCalledWith(event2);
  });

  test('should unsubscribe from specific event type', () => {
    // 创建一个模拟的监听器函数
    const listener = vi.fn();

    // 订阅 USER_MESSAGE_SENT 事件并获取取消订阅函数
    const unsubscribe = eventBus.subscribe(MessageEventType.USER_MESSAGE_SENT, listener);

    // 创建一个事件
    const event: MessageEvent = {
      type: MessageEventType.USER_MESSAGE_SENT,
      data: {
        threadId: 'thread-1',
        userId: 'user-1',
        content: 'Hello',
        messageId: 'message-1'
      }
    };

    // 发布事件
    eventBus.publish(event);

    // 验证监听器被调用
    expect(listener).toHaveBeenCalledTimes(1);

    // 取消订阅
    unsubscribe();

    // 再次发布事件
    eventBus.publish(event);

    // 验证监听器没有被再次调用
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('should unsubscribe from all events', () => {
    // 创建一个模拟的监听器函数
    const listener = vi.fn();

    // 订阅所有事件并获取取消订阅函数
    const unsubscribe = eventBus.subscribeAll(listener);

    // 创建一个事件
    const event: MessageEvent = {
      type: MessageEventType.USER_MESSAGE_SENT,
      data: {
        threadId: 'thread-1',
        userId: 'user-1',
        content: 'Hello',
        messageId: 'message-1'
      }
    };

    // 发布事件
    eventBus.publish(event);

    // 验证监听器被调用
    expect(listener).toHaveBeenCalledTimes(1);

    // 取消订阅
    unsubscribe();

    // 再次发布事件
    eventBus.publish(event);

    // 验证监听器没有被再次调用
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('should handle errors in listeners', () => {
    // 模拟 console.error
    const originalConsoleError = console.error;
    console.error = vi.fn();

    // 创建一个会抛出错误的监听器
    const errorListener = vi.fn().mockImplementation(() => {
      throw new Error('Test error');
    });

    // 创建一个正常的监听器
    const normalListener = vi.fn();

    // 订阅事件
    eventBus.subscribe(MessageEventType.USER_MESSAGE_SENT, errorListener);
    eventBus.subscribe(MessageEventType.USER_MESSAGE_SENT, normalListener);

    // 创建一个事件
    const event: MessageEvent = {
      type: MessageEventType.USER_MESSAGE_SENT,
      data: {
        threadId: 'thread-1',
        userId: 'user-1',
        content: 'Hello',
        messageId: 'message-1'
      }
    };

    // 发布事件
    eventBus.publish(event);

    // 验证错误被记录
    expect(console.error).toHaveBeenCalled();

    // 验证正常的监听器仍然被调用
    expect(normalListener).toHaveBeenCalledTimes(1);

    // 恢复 console.error
    console.error = originalConsoleError;
  });

  test('getMessageEventBus should return the same instance', () => {
    const instance1 = getMessageEventBus();
    const instance2 = getMessageEventBus();

    expect(instance1).toBe(instance2);
  });
});
