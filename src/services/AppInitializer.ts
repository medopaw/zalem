/**
 * 应用初始化
 *
 * 负责初始化应用所需的所有服务和组件
 */

import { getSupabase } from '../services/supabase';
import { initializeAIService, getAIService } from './ai/AIService';
import { createSupabaseUserRepository } from '../repositories/SupabaseUserRepository';
import { SupabaseMessageRepository } from '../repositories/SupabaseMessageRepository';
import { SupabaseThreadRepository } from '../repositories/SupabaseThreadRepository';
import { SupabasePregeneratedMessageRepository } from '../repositories/SupabasePregeneratedMessageRepository';
import { initializeToolProcessors } from './toolProcessors/ToolProcessorFactory';
import { createMessageService } from './messaging/MessageService';
import { createMessageSender } from './messaging/MessageSender';
import { getToolCallProcessorRegistry } from './messaging/ToolCallProcessorRegistry';
import { IMessageService } from '../types/messaging';
import { IMessageSender } from '../types/messaging/IMessageSender';
import {
  initializeEventHandlers,
  createMessageEventHandlerRegistry
} from './eventHandlers/initEventHandlers';
import { getEventBusProvider } from './messaging/EventBusProvider';

// 存储初始化状态
let isInitialized = false;
let messageService: IMessageService | null = null;
let messageSender: IMessageSender | null = null;

/**
 * 初始化应用
 */
export async function initializeApp(apiKey: string): Promise<void> {
  if (isInitialized) {
    console.log('[AppInitializer] App already initialized');
    return;
  }

  try {
    console.log('[AppInitializer] Initializing app...');

    // 1. 初始化AI服务
    await initializeAIService(apiKey);
    const aiService = getAIService();

    // 2. 获取 Supabase 客户端实例
    const supabase = getSupabase();

    // 3. 创建存储库
    const userRepository = createSupabaseUserRepository(supabase);
    const messageRepository = new SupabaseMessageRepository(supabase);
    const threadRepository = new SupabaseThreadRepository(supabase);
    const pregeneratedMessageRepository = new SupabasePregeneratedMessageRepository(supabase);

    // 4. 初始化工具处理器
    initializeToolProcessors(userRepository, pregeneratedMessageRepository);

    // 5. 初始化事件处理器 - 确保在创建消息服务之前初始化
    console.log('[AppInitializer] Initializing event handlers...');

    try {
      // 获取事件总线提供者
      const eventBusProvider = getEventBusProvider();
      const eventBus = eventBusProvider.getEventBus();
      console.log('[AppInitializer] Got event bus from provider');

      // 创建事件处理器注册表
      const eventHandlerRegistry = createMessageEventHandlerRegistry(
        eventBus,
        messageRepository,
        aiService
      );
      console.log('[AppInitializer] Created event handler registry');

      // 初始化所有事件处理器
      eventHandlerRegistry.initializeAllHandlers();
      console.log('[AppInitializer] All event handlers initialized through registry');

      // 为了向后兼容，保留全局引用
      (window as any).__eventHandlerRegistry = eventHandlerRegistry;

      // 检查是否成功初始化
      setTimeout(async () => {
        try {
          // 使用注册表检查是否有工具调用结果事件处理器
          // 使用已导入的 MessageEventType
          const { MessageEventType } = await import('../../types/messaging');
          const handlerCount = eventHandlerRegistry.getHandlerCount(
            MessageEventType.TOOL_RESULT_SENT
          );

          console.log('[AppInitializer] Tool result event handlers count:', handlerCount);

          if (handlerCount <= 0) {
            console.error('[AppInitializer] No tool result event handlers registered, retrying...');

            // 重试初始化
            eventHandlerRegistry.initializeAllHandlers();
            console.log('[AppInitializer] Retried initializing event handlers');
          }
        } catch (checkError) {
          console.error('[AppInitializer] Error checking event handlers:', checkError);
        }
      }, 500);
    } catch (error) {
      console.error('[AppInitializer] Error initializing event handlers:', error);

      // 如果使用新方式失败，回退到旧方式
      console.warn('[AppInitializer] Falling back to legacy event handler initialization');
      try {
        // 初始化事件处理器（旧方式）
        initializeEventHandlers(messageRepository, aiService);
      } catch (fallbackError) {
        console.error('[AppInitializer] Even legacy initialization failed:', fallbackError);
      }
    }

    console.log('[AppInitializer] Event handlers initialization process completed');

    // 6. 创建消息服务和消息发送器
    // 获取事件总线实例
    const eventBus = getEventBusProvider().getEventBus();

    // 使用依赖注入创建消息服务
    messageService = createMessageService(
      messageRepository,
      threadRepository,
      aiService,
      eventBus
    );

    // 创建消息发送器
    messageSender = createMessageSender(
      messageRepository,
      aiService,
      eventBus
    );

    // 为了向后兼容，保留全局引用
    (window as any).__messageSender = messageSender;

    isInitialized = true;
    console.log('[AppInitializer] App initialized successfully');
  } catch (error) {
    console.error('[AppInitializer] Failed to initialize app:', error);
    throw error;
  }
}

/**
 * 获取消息服务实例
 */
export function getMessageService(): IMessageService {
  if (!messageService) {
    throw new Error('App not initialized. Call initializeApp first.');
  }
  return messageService;
}

/**
 * 获取消息发送器实例
 */
export function getMessageSender(): IMessageSender {
  if (!messageSender) {
    throw new Error('App not initialized. Call initializeApp first.');
  }
  return messageSender;
}

/**
 * 检查应用是否已初始化
 */
export function isAppInitialized(): boolean {
  return isInitialized;
}
