/**
 * 应用初始化
 *
 * 负责初始化应用所需的所有服务和组件
 */

import { getSupabase } from '../services/supabase';
import { initializeAIService } from './ai/AIService';
import { createSupabaseUserRepository } from '../repositories/SupabaseUserRepository';
import { SupabaseMessageRepository } from '../repositories/SupabaseMessageRepository';
import { SupabaseThreadRepository } from '../repositories/SupabaseThreadRepository';
import { SupabasePregeneratedMessageRepository } from '../repositories/SupabasePregeneratedMessageRepository';
import { initializeToolProcessors } from './toolProcessors/ToolProcessorFactory';
import { createMessageService } from './messaging/MessageService';
import { getToolCallProcessorRegistry } from './messaging/ToolCallProcessorRegistry';
import { IMessageService } from '../types/messaging';

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

    // 2. 获取 Supabase 客户端实例
    const supabase = getSupabase();

    // 3. 创建存储库
    const userRepository = createSupabaseUserRepository(supabase);
    const messageRepository = new SupabaseMessageRepository(supabase);
    const threadRepository = new SupabaseThreadRepository(supabase);
    const pregeneratedMessageRepository = new SupabasePregeneratedMessageRepository(supabase);

    // 3. 初始化工具处理器
    initializeToolProcessors(userRepository, pregeneratedMessageRepository);

    // 4. 创建消息服务
    messageService = createMessageService(
      messageRepository,
      threadRepository,
      getToolCallProcessorRegistry()
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
