/**
 * 事件处理器注册表
 *
 * 负责管理所有事件处理器，提供统一的注册和获取接口
 */

import { MessageEventType, MessageEventListener } from '../../types/messaging';
import { IMessageEventBus } from '../../types/messaging';

/**
 * 事件处理器注册表接口
 */
export interface IEventHandlerRegistry {
  /**
   * 注册事件处理器
   * @param eventType 事件类型
   * @param handler 事件处理器
   * @returns 取消注册的函数
   */
  registerHandler(eventType: MessageEventType, handler: MessageEventListener): () => void;

  /**
   * 获取特定类型的事件处理器数量
   * @param eventType 事件类型
   */
  getHandlerCount(eventType: MessageEventType): number;

  /**
   * 初始化所有事件处理器
   */
  initializeAllHandlers(): void;
}

/**
 * 事件处理器注册表实现
 */
export class EventHandlerRegistry implements IEventHandlerRegistry {
  private unsubscribeFunctions: Map<string, () => void> = new Map();

  /**
   * 创建事件处理器注册表
   * @param eventBus 事件总线实例
   */
  constructor(private eventBus: IMessageEventBus) {
    console.log('[EventHandlerRegistry] Created with event bus instance');
  }

  /**
   * 注册事件处理器
   * @param eventType 事件类型
   * @param handler 事件处理器
   * @returns 取消注册的函数
   */
  registerHandler(eventType: MessageEventType, handler: MessageEventListener): () => void {
    // 生成唯一标识符
    const handlerId = `${eventType}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    console.log(`[EventHandlerRegistry] Registering handler for event type: ${eventType}, ID: ${handlerId}`);

    // 订阅事件
    const unsubscribe = this.eventBus.subscribe(eventType, handler);

    // 保存取消订阅函数
    this.unsubscribeFunctions.set(handlerId, unsubscribe);

    // 返回取消注册的函数
    return () => {
      unsubscribe();
      this.unsubscribeFunctions.delete(handlerId);
      console.log(`[EventHandlerRegistry] Unregistered handler: ${handlerId}`);
    };
  }

  /**
   * 获取特定类型的事件处理器数量
   * @param eventType 事件类型
   */
  getHandlerCount(eventType: MessageEventType): number {
    // 使用 MessageEventBus 的内部方法获取处理器数量
    const eventBusWithCount = this.eventBus as unknown as { getListenerCount(eventType: MessageEventType): number };
    
    if (typeof eventBusWithCount.getListenerCount === 'function') {
      return eventBusWithCount.getListenerCount(eventType);
    }
    
    // 如果无法获取确切数量，返回-1表示未知
    return -1;
  }

  /**
   * 初始化所有事件处理器
   * 这个方法将在应用启动时调用，用于注册所有必要的事件处理器
   */
  initializeAllHandlers(): void {
    console.log('[EventHandlerRegistry] Initializing all event handlers');
    
    // 这个方法将在子类中实现，注册特定的事件处理器
  }
}

/**
 * 创建事件处理器注册表实例
 * @param eventBus 事件总线实例
 */
export function createEventHandlerRegistry(eventBus: IMessageEventBus): IEventHandlerRegistry {
  return new EventHandlerRegistry(eventBus);
}
