/**
 * 系统初始化模块
 *
 * 这个模块负责按正确顺序初始化所有系统组件，避免循环依赖问题。
 */

import { getMessageTypeRegistry } from './MessageTypeRegistry';
// 明确从 .tsx 文件导入，因为这个文件包含了渲染组件的注册
import { initializeMessageHandlers } from './registerMessageHandlers.tsx';

// 记录系统是否已初始化
let systemInitialized = false;
// 记录初始化错误
let initializationError: Error | null = null;

/**
 * 初始化系统
 * 按正确顺序初始化所有系统组件
 *
 * @returns 是否成功初始化
 * @throws Error 如果初始化失败
 */
export function initializeSystem(): boolean {
  // 如果系统已初始化，直接返回
  if (systemInitialized) {
    console.log('[System] System already initialized');
    return true;
  }

  // 如果之前有初始化错误，抛出该错误
  if (initializationError) {
    throw initializationError;
  }

  console.log('[System] Initializing system...');

  try {
    // 1. 获取 MessageTypeRegistry 实例
    const registry = getMessageTypeRegistry();
    console.log('[System] Got MessageTypeRegistry instance');

    // 2. 初始化消息处理器 - 明确使用 registerMessageHandlers.tsx 中的函数
    // 这个函数负责注册所有消息类型的渲染器
    const handlersInitialized = initializeMessageHandlers(registry);

    if (!handlersInitialized) {
      const error = new Error('Failed to initialize message handlers. 消息处理器初始化失败，无法显示消息内容。');
      initializationError = error;
      throw error;
    }

    console.log('[System] Message handlers initialized');

    // 3. 初始化其他系统组件
    // ...

    // 标记系统为已初始化
    systemInitialized = true;
    console.log('[System] System initialized successfully');
    return true;
  } catch (error) {
    // 记录错误并重新抛出
    console.error('[System] Failed to initialize system:', error);
    if (error instanceof Error) {
      initializationError = error;
    } else {
      initializationError = new Error('Unknown initialization error');
    }
    throw initializationError;
  }
}

/**
 * 获取已初始化的 MessageTypeRegistry 实例
 *
 * @returns MessageTypeRegistry 实例
 * @throws Error 如果系统未初始化且有初始化错误
 */
export function getInitializedRegistry() {
  // 获取 MessageTypeRegistry 实例
  const registry = getMessageTypeRegistry();

  // 如果系统已初始化，直接返回实例
  if (systemInitialized) {
    return registry;
  }

  // 如果有初始化错误，抛出该错误
  if (initializationError) {
    throw initializationError;
  }

  // 如果系统未初始化且没有错误，尝试初始化
  try {
    console.log('[System] Initializing system from getInitializedRegistry');
    initializeSystem();
  } catch (error) {
    console.error('[System] Failed to initialize system from getInitializedRegistry:', error);
    // 错误已经在 initializeSystem 中记录，这里不需要再次记录
  }

  // 无论初始化是否成功，都返回实例
  // 这样可以避免在渲染过程中阻塞
  return registry;
}
