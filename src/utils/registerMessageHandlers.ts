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

  // 直接从 ToolResultEventHandler 导入创建函数
  const { createToolResultEventHandler } = require('../services/eventHandlers/ToolResultEventHandler');
  const { createToolCallEventHandler } = require('../services/eventHandlers/ToolCallEventHandler');
  const { MessageEventType } = require('../types/messaging');
  const { getMessageEventBus } = require('../services/messaging/MessageEventBus');

  // 设置一个强制初始化函数，确保事件处理器被初始化
  const forceInitializeEventHandlers = () => {
    try {
      // 尝试获取 AI 服务
      const aiService = getAIService();

      // 直接创建事件处理器实例，而不是通过 initializeEventHandlers
      console.log('[MessageHandlers] Directly creating event handlers...');

      // 创建工具调用事件处理器
      const toolCallHandler = createToolCallEventHandler(messageRepository);
      console.log('[MessageHandlers] ToolCallEventHandler created:', !!toolCallHandler);

      // 创建工具调用结果事件处理器
      const toolResultHandler = createToolResultEventHandler(messageRepository, aiService);
      console.log('[MessageHandlers] ToolResultEventHandler created:', !!toolResultHandler);

      // 检查事件总线中是否有 TOOL_RESULT_SENT 事件的监听器
      const eventBus = getMessageEventBus();
      const hasToolResultListener = eventBus.listeners.has(MessageEventType.TOOL_RESULT_SENT);
      console.log('[MessageHandlers] Has TOOL_RESULT_SENT listener:', hasToolResultListener);

      return true;
    } catch (error) {
      console.error('[MessageHandlers] Error in forceInitializeEventHandlers:', error);
      return false;
    }
  };

  // 尝试初始化事件处理器
  const success = forceInitializeEventHandlers();

  if (success) {
    console.log('[MessageHandlers] Event handlers initialized successfully');
  } else {
    console.log('[MessageHandlers] Failed to initialize event handlers, will retry in 2 seconds');

    // 设置定时器，2秒后重试初始化事件处理器
    setTimeout(() => {
      const retrySuccess = forceInitializeEventHandlers();
      console.log('[MessageHandlers] Retry initialization result:', retrySuccess);
    }, 2000);
  }

  // 标记为已初始化
  handlersInitialized = true;
}
