/**
 * 兼容层 - 为了保持向后兼容性
 *
 * 这个文件将在未来版本中移除，请直接使用 AIService
 * @deprecated 请使用 src/services/ai/AIService.ts
 */

import { AIService, initializeAIService, getAIService } from './ai/AIService';
import { SYSTEM_PROMPT } from '../constants/prompts';

// 重新导出 AIService 为 ChatService，保持向后兼容
export { AIService as ChatService };
export { initializeAIService as initializeChatService };
export { SYSTEM_PROMPT };

/**
 * 获取聊天服务实例
 * @returns 聊天服务实例
 * @throws {Error} 如果服务未初始化
 */
export function getChatService(): AIService {
  try {
    return getAIService();
  } catch (_) {
    throw new Error('Chat service not initialized');
  }
}
