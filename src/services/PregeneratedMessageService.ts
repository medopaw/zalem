import { SupabaseClient } from '@supabase/supabase-js';
import { getChatService } from './ChatService';
import { SupabasePregeneratedMessageRepository } from '../repositories/SupabasePregeneratedMessageRepository';
import { IPregeneratedMessageRepository } from '../repositories/IPregeneratedMessageRepository';
import { WELCOME_MESSAGE_SYSTEM_PROMPT } from '../constants/prompts';

/**
 * 预生成消息服务
 * 负责生成和管理预生成消息
 */
export class PregeneratedMessageService {
  private supabase: SupabaseClient;
  private repository: IPregeneratedMessageRepository;

  /**
   * 构造函数
   * @param supabase Supabase客户端
   */
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.repository = new SupabasePregeneratedMessageRepository(supabase);
  }

  /**
   * 检查用户是否有可用的预生成消息
   * @param userId 用户ID
   * @returns 是否有可用的预生成消息
   */
  async hasAvailableMessages(userId: string): Promise<boolean> {
    try {
      const count = await this.repository.getUnusedMessageCount(userId);
      return count > 0;
    } catch (error) {
      console.error('Error checking available messages:', error);
      return false;
    }
  }

  /**
   * 为用户生成预生成消息
   * @param userId 用户ID
   * @returns 是否成功生成消息
   */
  async generateMessageForUser(userId: string): Promise<boolean> {
    try {
      console.log(`Generating messages for user ${userId} on-demand`);

      // 获取用户信息
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('nickname')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error('Error fetching user data:', userError);
        return false;
      }

      // 生成隐藏的用户消息
      const hiddenMessage = "你好，我刚开始一个新的对话。请用友好的方式问候我，询问我最近在忙什么或者我的状态，但不要让你的回复看起来像是在回答我的问题。";

      // 生成系统提示
      const systemPrompt = WELCOME_MESSAGE_SYSTEM_PROMPT.replace('{nickname}', userData?.nickname ? `（昵称：${userData.nickname}）` : '');

      // 获取AI响应
      const chatService = getChatService();
      const response = await chatService.sendSingleMessage(systemPrompt, hiddenMessage);
      const aiResponse = response.content || "你好！最近怎么样？有什么我能帮到你的吗？";

      // 保存预生成消息
      const success = await this.repository.saveMessage(userId, hiddenMessage, aiResponse);

      if (!success) {
        console.error(`Failed to save pregenerated message for user ${userId}`);
        return false;
      }

      console.log(`Successfully generated messages for user ${userId}`);
      return true;
    } catch (error) {
      console.error(`Error generating messages for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * 确保用户有可用的预生成消息
   * 如果没有，则生成一个
   * @param userId 用户ID
   * @returns 是否有可用的预生成消息
   */
  async ensureAvailableMessage(userId: string): Promise<boolean> {
    try {
      // 检查是否有可用的预生成消息
      const hasMessages = await this.hasAvailableMessages(userId);

      // 如果没有，则生成一个
      if (!hasMessages) {
        console.log(`No pregenerated messages available for user ${userId}, generating one`);
        return await this.generateMessageForUser(userId);
      }

      return true;
    } catch (error) {
      console.error(`Error ensuring available message for user ${userId}:`, error);
      return false;
    }
  }
}
