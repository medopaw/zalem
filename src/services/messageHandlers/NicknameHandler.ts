import { BaseHandler } from './BaseHandler';
import type { MessageContext, ChatMessage, LLMMessage } from '../../types/messages';

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
            type: 'execution_result',
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
    const { error } = await context.supabase
      .from('users')
      .update({ nickname: params.nickname })
      .eq('id', context.userId);

    if (error) throw error;

    messages.push(await this.saveMessage(
      JSON.stringify({
        type: 'execution_result',
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

    messages.push(await this.saveMessage(
      JSON.stringify({
        type: 'execution_result',
        status: 'success',
        message: '昵称已清除'
      }),
      'assistant',
      context
    ));
  }
}
