/**
 * 事件总线提供者
 *
 * 负责创建和管理事件总线实例，实现依赖注入模式
 */

import { IMessageEventBus } from '../../types/messaging';
import { MessageEventBus } from './MessageEventBus';

/**
 * 事件总线提供者接口
 */
export interface IEventBusProvider {
  /**
   * 获取事件总线实例
   */
  getEventBus(): IMessageEventBus;
}

/**
 * 事件总线提供者实现
 */
export class EventBusProvider implements IEventBusProvider {
  private eventBus: IMessageEventBus;

  /**
   * 创建事件总线提供者
   * @param eventBus 可选的事件总线实例，如果不提供则创建新实例
   */
  constructor(eventBus?: IMessageEventBus) {
    this.eventBus = eventBus || new MessageEventBus();
    console.log('[EventBusProvider] Created with event bus instance');
  }

  /**
   * 获取事件总线实例
   */
  getEventBus(): IMessageEventBus {
    return this.eventBus;
  }
}

// 创建单例实例
let instance: IEventBusProvider | null = null;

/**
 * 获取事件总线提供者实例
 * 如果实例不存在，则创建一个新实例
 * @returns 事件总线提供者实例
 */
export function getEventBusProvider(): IEventBusProvider {
  if (!instance) {
    console.log('[EventBusProvider] Creating new instance');
    instance = new EventBusProvider();
  }
  return instance;
}

/**
 * 设置事件总线提供者实例
 * 用于测试和依赖注入
 * @param provider 事件总线提供者实例
 */
export function setEventBusProvider(provider: IEventBusProvider): void {
  instance = provider;
  console.log('[EventBusProvider] Instance set externally');
}
