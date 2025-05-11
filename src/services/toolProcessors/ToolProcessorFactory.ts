/**
 * 工具处理器工厂
 * 
 * 负责创建和注册所有工具处理器
 */

import { IToolCallProcessor } from '../../types/messaging';
import { getToolCallProcessorRegistry } from '../messaging/ToolCallProcessorRegistry';
import { createNicknameProcessor } from './NicknameProcessor';
import { IUserRepository } from '../../repositories/IUserRepository';
import { IPregeneratedMessageRepository } from '../../repositories/IPregeneratedMessageRepository';

/**
 * 初始化所有工具处理器
 */
export function initializeToolProcessors(
  userRepository: IUserRepository,
  pregeneratedMessageRepository: IPregeneratedMessageRepository
): void {
  const registry = getToolCallProcessorRegistry();
  
  // 创建并注册昵称处理器
  const nicknameProcessor = createNicknameProcessor(
    userRepository,
    pregeneratedMessageRepository
  );
  registry.registerProcessor(nicknameProcessor);
  
  // 在这里添加其他工具处理器
  // 例如：registry.registerProcessor(createDataRequestProcessor(...));
  
  console.log('[ToolProcessorFactory] All tool processors initialized');
}

/**
 * 获取特定工具的处理器
 */
export function getToolProcessor(toolName: string): IToolCallProcessor | undefined {
  const registry = getToolCallProcessorRegistry();
  return registry.getProcessor(toolName);
}

/**
 * 获取所有已注册的工具处理器
 */
export function getAllToolProcessors(): IToolCallProcessor[] {
  const registry = getToolCallProcessorRegistry();
  return registry.getAllProcessors();
}
