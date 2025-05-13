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
import { getToolCallProcessorRegistry } from './messaging/ToolCallProcessorRegistry';
import { IMessageService } from '../types/messaging';
import { initializeEventHandlers } from './eventHandlers/initEventHandlers';

// 存储初始化状态
let isInitialized = false;
let messageService: IMessageService | null = null;

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

    // 确保事件处理器被正确初始化
    try {
      // 先清除可能存在的全局引用
      delete (window as any).__toolResultEventHandler;
      delete (window as any).__toolResultEventHandlerFn;
      delete (window as any).__toolResultEventHandlerUnsubscribe;
      delete (window as any).__toolResultEventHandlerGlobalUnsubscribe;

      // 初始化事件处理器
      initializeEventHandlers(messageRepository, aiService);

      // 检查是否成功初始化
      setTimeout(() => {
        const hasGlobalHandler = !!(window as any).__toolResultEventHandler;
        console.log('[AppInitializer] Tool result event handler initialized:', hasGlobalHandler);

        if (!hasGlobalHandler) {
          console.error('[AppInitializer] Failed to initialize tool result event handler, retrying...');

          // 重试初始化
          import('./eventHandlers/ToolResultEventHandler').then(module => {
            const { createToolResultEventHandler } = module;
            const handler = createToolResultEventHandler(messageRepository, aiService);
            console.log('[AppInitializer] Directly created tool result event handler:', !!handler);
          }).catch(error => {
            console.error('[AppInitializer] Failed to import ToolResultEventHandler:', error);
          });
        }
      }, 500);
    } catch (error) {
      console.error('[AppInitializer] Error initializing event handlers:', error);
    }

    console.log('[AppInitializer] Event handlers initialization process completed');

    // 6. 创建消息服务
    messageService = createMessageService(
      messageRepository,
      threadRepository,
      aiService
    );

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
 * 检查应用是否已初始化
 */
export function isAppInitialized(): boolean {
  return isInitialized;
}
