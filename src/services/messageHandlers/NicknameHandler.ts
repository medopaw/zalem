import { BaseHandler } from './BaseHandler';
import type { MessageContext, ChatMessage, LLMMessage } from '../../types/messages';
import { SupabasePregeneratedMessageRepository } from '../../repositories/SupabasePregeneratedMessageRepository';
import { IPregeneratedMessageRepository } from '../../repositories/IPregeneratedMessageRepository';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Handles nickname-related functions
 */
export class NicknameHandler extends BaseHandler {
  canHandle(message: LLMMessage): boolean {
    return message.tool_calls?.some(call =>
      ['set_nickname', 'clear_nickname'].includes(call.function.name)
    ) || false;
  }

  async handle(message: LLMMessage, context: MessageContext): Promise<ChatMessage[]> {
    const messages: ChatMessage[] = [];

    // Save the original message if present
    if (message.content) {
      messages.push(await this.saveMessage(message.content, 'assistant', context));
    }

    // Handle each nickname-related tool call
    for (const call of message.tool_calls || []) {
      if (!['set_nickname', 'clear_nickname'].includes(call.function.name)) {
        continue;
      }

      try {
        switch (call.function.name) {
          case 'set_nickname':
            await this.handleSetNickname(
              JSON.parse(call.function.arguments),
              context,
              messages
            );
            break;
          case 'clear_nickname':
            await this.handleClearNickname(context, messages);
            break;
        }
      } catch (error) {
        console.error('Error handling nickname operation:', error);
        messages.push(await this.saveMessage(
          JSON.stringify({
            type: 'tool_result',
            tool_call_id: call.id,
            status: 'error',
            message: error instanceof Error ? error.message : '操作失败'
          }),
          'assistant',
          context
        ));
        throw error;
      }
    }

    return messages;
  }

  private async handleSetNickname(
    params: { nickname: string },
    context: MessageContext,
    messages: ChatMessage[]
  ): Promise<void> {
    // 更新用户昵称
    const { error } = await context.supabase
      .from('users')
      .update({ nickname: params.nickname })
      .eq('id', context.userId);

    if (error) throw error;

    // 清除用户的预生成消息，因为昵称已更改
    await this.clearPregeneratedMessages(context.userId, context.supabase);

    messages.push(await this.saveMessage(
      JSON.stringify({
        type: 'tool_result',
        tool_call_id: 'set_nickname', // 注意：这里没有真正的tool_call_id，使用函数名代替
        status: 'success',
        message: `昵称已设置为 ${params.nickname}`
      }),
      'assistant',
      context
    ));
  }

  private async handleClearNickname(
    context: MessageContext,
    messages: ChatMessage[]
  ): Promise<void> {
    const { error } = await context.supabase
      .from('users')
      .update({ nickname: null })
      .eq('id', context.userId);

    if (error) throw error;

    // 清除用户的预生成消息，因为昵称已清除
    await this.clearPregeneratedMessages(context.userId, context.supabase);

    messages.push(await this.saveMessage(
      JSON.stringify({
        type: 'tool_result',
        tool_call_id: 'clear_nickname', // 注意：这里没有真正的tool_call_id，使用函数名代替
        status: 'success',
        message: '昵称已清除'
      }),
      'assistant',
      context
    ));
  }

  /**
   * 清除用户的预生成消息
   * @param userId 用户ID
   * @param supabase Supabase客户端
   */
  private async clearPregeneratedMessages(userId: string, supabase: SupabaseClient): Promise<void> {
    try {
      // 创建预生成消息存储库
      const repository: IPregeneratedMessageRepository = new SupabasePregeneratedMessageRepository(supabase);

      // 清除未使用的预生成消息
      const success = await repository.clearUnusedMessages(userId);

      if (!success) {
        console.error(`清除用户 ${userId} 的预生成消息失败`);
      }
    } catch (error) {
      console.error('清除预生成消息时出错:', error);
    }
  }
}
