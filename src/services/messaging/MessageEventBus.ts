/**
 * 消息事件总线实现
 *
 * 负责消息事件的发布和订阅
 */

import {
  IMessageEventBus,
  MessageEvent,
  MessageEventType,
  MessageEventListener
} from '../../types/messaging';

/**
 * 消息事件总线实现
 */
export class MessageEventBus implements IMessageEventBus {
  private listeners: Map<MessageEventType, Set<MessageEventListener>> = new Map();
  private allListeners: Set<MessageEventListener> = new Set();

  /**
   * 创建消息事件总线实例
   */
  constructor() {
    console.log('[MessageEventBus] New instance created');
  }

  /**
   * 发布消息事件
   */
  publish(event: MessageEvent): void {
    console.log(`[MessageEventBus] Publishing event: ${event.type}`, event.data);

    // 调用特定类型的监听器
    const typeListeners = this.listeners.get(event.type);
    if (typeListeners) {
      console.log(`[MessageEventBus] Found ${typeListeners.size} listeners for event type: ${event.type}`);
      typeListeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`[MessageEventBus] Error in listener for ${event.type}:`, error);
        }
      });
    } else {
      console.warn(`[MessageEventBus] No listeners found for event type: ${event.type}`);

      // 特别处理工具调用结果事件
      if (event.type === MessageEventType.TOOL_RESULT_SENT) {
        console.error('[MessageEventBus] CRITICAL: No listeners for TOOL_RESULT_SENT event! ToolResultEventHandler may not be initialized.');
        console.error('[MessageEventBus] Registered event types:', Array.from(this.listeners.keys()));

        // 打印所有已注册的监听器
        console.log('[MessageEventBus] All registered listeners:');
        this.listeners.forEach((listeners, type) => {
          console.log(`- ${type}: ${listeners.size} listeners`);
        });
      }
    }

    // 调用所有事件的监听器
    if (this.allListeners.size > 0) {
      console.log(`[MessageEventBus] Found ${this.allListeners.size} global listeners`);
      this.allListeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`[MessageEventBus] Error in global listener for ${event.type}:`, error);
        }
      });
    } else {
      console.log('[MessageEventBus] No global listeners registered');
    }
  }

  /**
   * 订阅特定类型的消息事件
   * @returns 取消订阅的函数
   */
  subscribe(eventType: MessageEventType, listener: MessageEventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    const typeListeners = this.listeners.get(eventType)!;
    typeListeners.add(listener);

    return () => {
      typeListeners.delete(listener);
      if (typeListeners.size === 0) {
        this.listeners.delete(eventType);
      }
    };
  }

  /**
   * 订阅所有消息事件
   * @returns 取消订阅的函数
   */
  subscribeAll(listener: MessageEventListener): () => void {
    this.allListeners.add(listener);

    return () => {
      this.allListeners.delete(listener);
    };
  }

  /**
   * 获取特定类型的监听器数量
   * 用于测试和调试
   */
  getListenerCount(eventType?: MessageEventType): number {
    if (eventType) {
      const typeListeners = this.listeners.get(eventType);
      return typeListeners ? typeListeners.size : 0;
    } else {
      return this.allListeners.size;
    }
  }

  /**
   * 检查是否有特定类型的监听器
   * 用于测试和调试
   */
  hasListeners(eventType: MessageEventType): boolean {
    return this.listeners.has(eventType);
  }

  /**
   * 获取所有已注册的事件类型
   * 用于测试和调试
   */
  getRegisteredEventTypes(): MessageEventType[] {
    return Array.from(this.listeners.keys());
  }
}

// 创建单例实例 - 为了向后兼容
const messageEventBus = new MessageEventBus();

/**
 * 获取消息事件总线实例
 *
 * @deprecated 使用 EventBusProvider 替代
 * 为了向后兼容保留此函数，新代码应该使用依赖注入或 EventBusProvider
 */
export function getMessageEventBus(): IMessageEventBus {
  console.log('[MessageEventBus] Using deprecated getMessageEventBus() function');

  // 导入 EventBusProvider
  try {
    // 动态导入以避免循环依赖
    const { getEventBusProvider } = require('./EventBusProvider');
    return getEventBusProvider().getEventBus();
  } catch (error) {
    console.warn('[MessageEventBus] Failed to use EventBusProvider, falling back to singleton instance:', error);
    return messageEventBus;
  }
}
