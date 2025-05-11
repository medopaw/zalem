/**
 * 昵称工具处理器
 * 
 * 处理设置和清除昵称的工具调用
 */

import { 
  IToolCallProcessor, 
  ToolCallData, 
  ToolResultData 
} from '../../types/messaging';
import { IUserRepository } from '../../repositories/IUserRepository';
import { IPregeneratedMessageRepository } from '../../repositories/IPregeneratedMessageRepository';

/**
 * 昵称工具处理器实现
 */
export class NicknameProcessor implements IToolCallProcessor {
  private readonly SUPPORTED_TOOLS = ['set_nickname', 'clear_nickname'];
  
  constructor(
    private userRepository: IUserRepository,
    private pregeneratedMessageRepository: IPregeneratedMessageRepository
  ) {}
  
  /**
   * 检查是否可以处理特定工具
   */
  canProcess(toolName: string): boolean {
    return this.SUPPORTED_TOOLS.includes(toolName);
  }
  
  /**
   * 处理工具调用
   */
  async processToolCall(
    toolCall: ToolCallData, 
    threadId: string, 
    userId: string
  ): Promise<ToolResultData> {
    console.log(`[NicknameProcessor] Processing ${toolCall.name}`, toolCall.arguments);
    
    try {
      switch (toolCall.name) {
        case 'set_nickname':
          return await this.handleSetNickname(toolCall, userId);
        case 'clear_nickname':
          return await this.handleClearNickname(toolCall, userId);
        default:
          throw new Error(`Unsupported tool: ${toolCall.name}`);
      }
    } catch (error) {
      console.error(`[NicknameProcessor] Error processing ${toolCall.name}:`, error);
      return {
        toolCallId: toolCall.id,
        status: 'error',
        result: null,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * 处理设置昵称
   */
  private async handleSetNickname(
    toolCall: ToolCallData, 
    userId: string
  ): Promise<ToolResultData> {
    const { nickname } = toolCall.arguments;
    
    if (!nickname) {
      throw new Error('昵称不能为空');
    }
    
    // 更新用户昵称
    await this.userRepository.updateNickname(userId, nickname);
    
    // 清除预生成消息
    await this.clearPregeneratedMessages(userId);
    
    return {
      toolCallId: toolCall.id,
      status: 'success',
      result: { nickname },
      message: `昵称已设置为 ${nickname}`
    };
  }
  
  /**
   * 处理清除昵称
   */
  private async handleClearNickname(
    toolCall: ToolCallData, 
    userId: string
  ): Promise<ToolResultData> {
    // 清除用户昵称
    await this.userRepository.updateNickname(userId, null);
    
    // 清除预生成消息
    await this.clearPregeneratedMessages(userId);
    
    return {
      toolCallId: toolCall.id,
      status: 'success',
      result: { nickname: null },
      message: '昵称已清除'
    };
  }
  
  /**
   * 清除预生成消息
   */
  private async clearPregeneratedMessages(userId: string): Promise<void> {
    try {
      const success = await this.pregeneratedMessageRepository.clearUnusedMessages(userId);
      
      if (!success) {
        console.warn(`[NicknameProcessor] Failed to clear pregenerated messages for user ${userId}`);
      }
    } catch (error) {
      console.error('[NicknameProcessor] Error clearing pregenerated messages:', error);
    }
  }
}

/**
 * 创建昵称处理器
 */
export function createNicknameProcessor(
  userRepository: IUserRepository,
  pregeneratedMessageRepository: IPregeneratedMessageRepository
): IToolCallProcessor {
  return new NicknameProcessor(userRepository, pregeneratedMessageRepository);
}
