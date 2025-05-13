import { describe, test, expect, beforeEach, vi } from 'vitest';
import { ToolCallProcessorRegistry, getToolCallProcessorRegistry } from '../ToolCallProcessorRegistry';
import { IToolCallProcessor } from '../../../types/messaging';

describe('ToolCallProcessorRegistry', () => {
  let registry: ToolCallProcessorRegistry;
  
  // 创建模拟的工具处理器
  const createMockProcessor = (supportedTools: string[]): IToolCallProcessor => ({
    canProcess: (toolName: string) => supportedTools.includes(toolName),
    processToolCall: vi.fn()
  });
  
  beforeEach(() => {
    // 创建新的注册表实例，避免测试之间的干扰
    registry = new ToolCallProcessorRegistry();
  });
  
  test('should register and retrieve processor', () => {
    // 创建一个处理 'test_tool' 的处理器
    const processor = createMockProcessor(['test_tool']);
    
    // 注册处理器
    registry.registerProcessor(processor);
    
    // 获取处理器
    const retrievedProcessor = registry.getProcessor('test_tool');
    
    // 验证获取到的是同一个处理器
    expect(retrievedProcessor).toBe(processor);
  });
  
  test('should return undefined for unknown tool', () => {
    // 创建一个处理 'test_tool' 的处理器
    const processor = createMockProcessor(['test_tool']);
    
    // 注册处理器
    registry.registerProcessor(processor);
    
    // 尝试获取未知工具的处理器
    const retrievedProcessor = registry.getProcessor('unknown_tool');
    
    // 验证返回 undefined
    expect(retrievedProcessor).toBeUndefined();
  });
  
  test('should return first matching processor when multiple processors can handle the same tool', () => {
    // 创建两个都能处理 'common_tool' 的处理器
    const processor1 = createMockProcessor(['common_tool', 'tool1']);
    const processor2 = createMockProcessor(['common_tool', 'tool2']);
    
    // 注册处理器，processor1 先注册
    registry.registerProcessor(processor1);
    registry.registerProcessor(processor2);
    
    // 获取处理器
    const retrievedProcessor = registry.getProcessor('common_tool');
    
    // 验证获取到的是第一个注册的处理器
    expect(retrievedProcessor).toBe(processor1);
  });
  
  test('should return all registered processors', () => {
    // 创建两个处理器
    const processor1 = createMockProcessor(['tool1']);
    const processor2 = createMockProcessor(['tool2']);
    
    // 注册处理器
    registry.registerProcessor(processor1);
    registry.registerProcessor(processor2);
    
    // 获取所有处理器
    const allProcessors = registry.getAllProcessors();
    
    // 验证返回的是所有注册的处理器
    expect(allProcessors).toHaveLength(2);
    expect(allProcessors).toContain(processor1);
    expect(allProcessors).toContain(processor2);
  });
  
  test('should return empty array when no processors are registered', () => {
    // 获取所有处理器
    const allProcessors = registry.getAllProcessors();
    
    // 验证返回空数组
    expect(allProcessors).toHaveLength(0);
  });
  
  test('getAllProcessors should return a copy of the processors array', () => {
    // 创建处理器
    const processor = createMockProcessor(['tool1']);
    
    // 注册处理器
    registry.registerProcessor(processor);
    
    // 获取所有处理器
    const allProcessors = registry.getAllProcessors();
    
    // 修改返回的数组
    allProcessors.pop();
    
    // 再次获取所有处理器
    const allProcessorsAgain = registry.getAllProcessors();
    
    // 验证原始数组没有被修改
    expect(allProcessorsAgain).toHaveLength(1);
  });
  
  test('getToolCallProcessorRegistry should return the same instance', () => {
    const instance1 = getToolCallProcessorRegistry();
    const instance2 = getToolCallProcessorRegistry();
    
    expect(instance1).toBe(instance2);
  });
});
