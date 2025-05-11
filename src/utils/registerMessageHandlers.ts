/**
 * 初始化消息处理器
 *
 * 这个文件负责初始化所有消息处理器，确保它们在应用启动时被创建
 */

import { getSupabase } from '../services/supabase';
import { SupabaseMessageRepository } from '../repositories/SupabaseMessageRepository';
import { SupabaseUserRepository } from '../repositories/SupabaseUserRepository';
import { SupabasePregeneratedMessageRepository } from '../repositories/SupabasePregeneratedMessageRepository';
import { getAIService } from '../services/ai/AIService';
import { initializeEventHandlers } from '../services/eventHandlers/initEventHandlers';
import { getToolCallProcessorRegistry } from '../services/messaging/ToolCallProcessorRegistry';
import { createNicknameProcessor } from '../services/toolProcessors/NicknameProcessor';

// 跟踪初始化状态
let handlersInitialized = false;

/**
 * 初始化所有消息处理器
 */
export function initializeMessageHandlers(): void {
  // 防止重复初始化
  if (handlersInitialized) {
    console.log('[MessageHandlers] Already initialized, skipping');
    return;
  }

  console.log('[MessageHandlers] Initializing message handlers...');

  // 获取 Supabase 客户端
  const supabase = getSupabase();

  // 创建存储库
  const messageRepository = new SupabaseMessageRepository(supabase);
  const userRepository = new SupabaseUserRepository(supabase);
  const pregeneratedMessageRepository = new SupabasePregeneratedMessageRepository(supabase);

  // 注册工具处理器
  const registry = getToolCallProcessorRegistry();

  // 创建并注册昵称处理器
  const nicknameProcessor = createNicknameProcessor(
    userRepository,
    pregeneratedMessageRepository
  );
  registry.registerProcessor(nicknameProcessor);

  // 检查 AI 服务是否已初始化
  try {
    // 尝试获取 AI 服务
    const aiService = getAIService();

    // 如果成功获取，初始化事件处理器
    initializeEventHandlers(messageRepository, aiService);
    console.log('[MessageHandlers] All message handlers initialized with AI service');
  } catch (error) {
    // AI 服务未初始化，记录日志但不抛出错误
    console.log('[MessageHandlers] AI service not initialized yet, event handlers will be initialized later');

    // 我们可以在这里设置一个监听器，当 AI 服务初始化后再初始化事件处理器
    // 或者在应用的其他地方确保正确的初始化顺序
  }

  // 标记为已初始化
  handlersInitialized = true;
}
