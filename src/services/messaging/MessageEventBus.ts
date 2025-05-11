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
   * 发布消息事件
   */
  publish(event: MessageEvent): void {
    console.log(`[MessageEventBus] Publishing event: ${event.type}`, event.data);
    
    // 调用特定类型的监听器
    const typeListeners = this.listeners.get(event.type);
    if (typeListeners) {
      typeListeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`[MessageEventBus] Error in listener for ${event.type}:`, error);
        }
      });
    }
    
    // 调用所有事件的监听器
    this.allListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error(`[MessageEventBus] Error in global listener for ${event.type}:`, error);
      }
    });
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
}

// 创建单例实例
const messageEventBus = new MessageEventBus();

/**
 * 获取消息事件总线实例
 */
export function getMessageEventBus(): IMessageEventBus {
  return messageEventBus;
}
