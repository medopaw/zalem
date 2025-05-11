/**
 * 工具调用处理器注册表
 * 
 * 负责管理和查找工具调用处理器
 */

import { IToolCallProcessor } from '../../types/messaging';

/**
 * 工具调用处理器注册表接口
 */
export interface IToolCallProcessorRegistry {
  /**
   * 注册工具处理器
   */
  registerProcessor(processor: IToolCallProcessor): void;
  
  /**
   * 获取工具处理器
   */
  getProcessor(toolName: string): IToolCallProcessor | undefined;
  
  /**
   * 获取所有已注册的处理器
   */
  getAllProcessors(): IToolCallProcessor[];
}

/**
 * 工具调用处理器注册表实现
 */
export class ToolCallProcessorRegistry implements IToolCallProcessorRegistry {
  private processors: IToolCallProcessor[] = [];
  
  /**
   * 注册工具处理器
   */
  registerProcessor(processor: IToolCallProcessor): void {
    this.processors.push(processor);
    console.log(`[ToolCallProcessorRegistry] Registered processor for tools`);
  }
  
  /**
   * 获取工具处理器
   */
  getProcessor(toolName: string): IToolCallProcessor | undefined {
    return this.processors.find(processor => processor.canProcess(toolName));
  }
  
  /**
   * 获取所有已注册的处理器
   */
  getAllProcessors(): IToolCallProcessor[] {
    return [...this.processors];
  }
}

// 创建单例实例
const toolCallProcessorRegistry = new ToolCallProcessorRegistry();

/**
 * 获取工具调用处理器注册表实例
 */
export function getToolCallProcessorRegistry(): IToolCallProcessorRegistry {
  return toolCallProcessorRegistry;
}
