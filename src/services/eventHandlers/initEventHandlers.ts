/**
 * 初始化事件处理器
 * 
 * 这个文件负责初始化所有事件处理器，确保它们在应用启动时被创建
 */

import { IMessageRepository } from '../../repositories/IMessageRepository';
import { AIService } from '../ai/AIService';
import { createToolCallEventHandler } from './ToolCallEventHandler';
import { createToolResultEventHandler } from './ToolResultEventHandler';

/**
 * 初始化所有事件处理器
 * 
 * @param messageRepository 消息存储库
 * @param aiService AI服务
 */
export function initializeEventHandlers(
  messageRepository: IMessageRepository,
  aiService: AIService
): void {
  // 创建工具调用事件处理器
  createToolCallEventHandler(messageRepository);
  
  // 创建工具调用结果事件处理器
  createToolResultEventHandler(messageRepository, aiService);
  
  console.log('[EventHandlers] All event handlers initialized');
}
