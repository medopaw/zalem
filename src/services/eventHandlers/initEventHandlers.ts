/**
 * 初始化事件处理器
 *
 * 这个文件负责初始化所有事件处理器，确保它们在应用启动时被创建
 */

import { IMessageRepository } from '../../repositories/IMessageRepository';
import { AIService } from '../ai/AIService';
import { createToolCallEventHandler } from './ToolCallEventHandler';
import { createToolResultEventHandler } from './ToolResultEventHandler';
import { IMessageEventBus } from '../../types/messaging';
import { IEventHandlerRegistry, EventHandlerRegistry } from './EventHandlerRegistry';

/**
 * 消息事件处理器注册表
 * 扩展基础注册表，添加特定于消息系统的事件处理器初始化
 */
export class MessageEventHandlerRegistry extends EventHandlerRegistry {
  private messageRepository: IMessageRepository;
  private aiService: AIService;

  /**
   * 创建消息事件处理器注册表
   */
  constructor(
    eventBus: IMessageEventBus,
    messageRepository: IMessageRepository,
    aiService: AIService
  ) {
    super(eventBus);
    this.messageRepository = messageRepository;
    this.aiService = aiService;
    console.log('[MessageEventHandlerRegistry] Created with dependencies');
  }

  /**
   * 初始化所有事件处理器
   * 重写基类方法，注册特定的事件处理器
   */
  override initializeAllHandlers(): void {
    console.log('[MessageEventHandlerRegistry] Initializing all message event handlers');

    // 创建工具调用事件处理器
    const toolCallHandler = createToolCallEventHandler(this.messageRepository);
    console.log('[MessageEventHandlerRegistry] Created tool call event handler');

    // 创建工具调用结果事件处理器
    const toolResultHandler = createToolResultEventHandler(this.messageRepository, this.aiService);
    console.log('[MessageEventHandlerRegistry] Created tool result event handler');

    // 保存处理器引用，防止被垃圾回收
    (window as any).__toolCallHandler = toolCallHandler;
    (window as any).__toolResultHandler = toolResultHandler;

    console.log('[MessageEventHandlerRegistry] All event handlers initialized and stored in global references');
  }
}

/**
 * 创建消息事件处理器注册表
 */
export function createMessageEventHandlerRegistry(
  eventBus: IMessageEventBus,
  messageRepository: IMessageRepository,
  aiService: AIService
): IEventHandlerRegistry {
  return new MessageEventHandlerRegistry(eventBus, messageRepository, aiService);
}

/**
 * 初始化所有事件处理器
 *
 * @deprecated 使用 MessageEventHandlerRegistry.initializeAllHandlers() 替代
 * @param messageRepository 消息存储库
 * @param aiService AI服务
 */
export function initializeEventHandlers(
  messageRepository: IMessageRepository,
  aiService: AIService
): void {
  console.log('[initEventHandlers] Using deprecated function, consider using MessageEventHandlerRegistry instead');

  // 创建工具调用事件处理器
  createToolCallEventHandler(messageRepository);

  // 创建工具调用结果事件处理器
  createToolResultEventHandler(messageRepository, aiService);

  console.log('[EventHandlers] All event handlers initialized');
}
