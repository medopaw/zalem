import { SupabaseClient } from '@supabase/supabase-js';
import { BackgroundTaskManager } from './BackgroundTaskManager';
import { PregeneratedMessageService } from '../PregeneratedMessageService';

/**
 * 预生成消息任务
 * 负责为用户预生成新对话的第一条消息
 */
export class PregenerateMessagesTask {
  private static readonly TASK_ID = 'pregenerate-messages';
  private static readonly MIN_MESSAGES = 1; // 每个用户至少保持的预生成消息数量
  private supabase: SupabaseClient;
  private messageService: PregeneratedMessageService;

  /**
   * 创建预生成消息任务
   * @param supabase Supabase客户端实例
   */
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.messageService = new PregeneratedMessageService(supabase);

    // 注册任务
    BackgroundTaskManager.getInstance().registerTask(
      PregenerateMessagesTask.TASK_ID,
      this.execute.bind(this)
    );

    console.log('PregenerateMessagesTask initialized');
  }

  /**
   * 执行任务
   */
  public async execute(): Promise<void> {
    try {
      console.log('Executing pregenerate messages task');

      // 获取当前登录用户
      const { data: authData } = await this.supabase.auth.getUser();
      const currentUser = authData?.user;

      if (!currentUser) {
        console.log('No user currently logged in, skipping message generation');
        return;
      }

      // 获取当前用户的详细信息
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('id, nickname')
        .eq('id', currentUser.id)
        .single();

      if (userError) {
        console.error('Error fetching current user details:', userError);
        return;
      }

      if (!userData) {
        console.log(`User profile not found for ID: ${currentUser.id}, skipping message generation`);
        return;
      }

      console.log(`Generating messages for current user: ${userData.id}`);

      // 只为当前登录用户生成消息
      await this.ensureMessagesForUser(userData.id);

      console.log('Pregenerate messages task completed for current user');
    } catch (error) {
      console.error('Error in pregenerate messages task:', error);
    }
  }

  /**
   * 确保用户有足够的预生成消息
   * @param userId 用户ID
   */
  private async ensureMessagesForUser(userId: string): Promise<void> {
    try {
      console.log(`Checking pregenerated messages for user: ${userId}`);

      // 获取用户当前的预生成消息数量
      const currentCount = await this.messageService.hasAvailableMessages(userId) ? 1 : 0;
      const neededCount = PregenerateMessagesTask.MIN_MESSAGES - currentCount;

      console.log(`User ${userId} has ${currentCount} pregenerated messages, needs ${neededCount} more`);

      // 如果需要，生成更多消息
      if (neededCount > 0) {
        for (let i = 0; i < neededCount; i++) {
          console.log(`Generating message ${i + 1} of ${neededCount} for user ${userId}`);
          await this.messageService.generateMessageForUser(userId);
        }
      }
    } catch (error) {
      console.error(`Error ensuring messages for user ${userId}:`, error);
    }
  }
}
