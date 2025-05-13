import { BaseHandler } from './BaseHandler';
import type { MessageContext, ChatMessage, LLMMessage } from '../../types/messages';
import { SupabasePregeneratedMessageRepository } from '../../repositories/SupabasePregeneratedMessageRepository';
import { IPregeneratedMessageRepository } from '../../repositories/IPregeneratedMessageRepository';
import { SupabaseClient } from '@supabase/supabase-js';
import { MessageType } from '../../utils/MessageTypeRegistry';

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

    // 保存工具调用消息
    if (message.tool_calls && message.tool_calls.length > 0) {
      // 创建工具调用消息
      for (const call of message.tool_calls) {
        if (!['set_nickname', 'clear_nickname'].includes(call.function.name)) {
          continue;
        }

        const toolCallContent = {
          type: 'tool_call',
          name: call.function.name,
          parameters: JSON.parse(call.function.arguments)
        };

        console.log('Saving tool call message:', toolCallContent);

        // 保存工具调用消息
        const savedMessage = await this.saveMessage(
          JSON.stringify(toolCallContent),
          'tool', // 使用tool角色保持一致性
          context
        );

        console.log('Saved tool call message:', savedMessage);
        messages.push(savedMessage);
      }
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
              messages,
              call.id
            );
            break;
          case 'clear_nickname':
            await this.handleClearNickname(
              context,
              messages,
              call.id
            );
            break;
        }
      } catch (error) {
        console.error('Error handling nickname operation:', error);
        const errorContent = {
          type: MessageType.TOOL_RESULT, // 使用枚举值确保匹配
          tool_call_id: call.id,
          status: 'error',
          message: error instanceof Error ? error.message : '操作失败'
        };

        console.log('Saving error message:', errorContent);

        // 保存错误消息 - 直接使用supabase以便设置send_to_llm为false
        let savedErrorMessage: ChatMessage;

        if (context.saveMessage) {
          // 如果有自定义的saveMessage方法，使用它
          savedErrorMessage = await context.saveMessage(JSON.stringify(errorContent), 'tool');

          // 然后更新send_to_llm字段为false
          await context.supabase
            .from('chat_messages')
            .update({ send_to_llm: false })
            .eq('id', savedErrorMessage.id);
        } else {
          // 直接使用supabase保存消息
          const { data, error: dbError } = await context.supabase
            .from('chat_messages')
            .insert([
              {
                content: JSON.stringify(errorContent),
                role: 'tool',
                user_id: context.userId,
                thread_id: context.threadId,
                send_to_llm: false // 明确设置为false
              },
            ])
            .select()
            .single();

          if (dbError) throw dbError;
          savedErrorMessage = data;
        }

        console.log('Saved error message:', savedErrorMessage);

        messages.push(savedErrorMessage);
        throw error;
      }
    }

    return messages;
  }

  private async handleSetNickname(
    params: { nickname: string },
    context: MessageContext,
    messages: ChatMessage[],
    toolCallId: string
  ): Promise<void> {
    // 更新用户昵称
    const { error } = await context.supabase
      .from('users')
      .update({ nickname: params.nickname })
      .eq('id', context.userId);

    if (error) throw error;

    // 清除用户的预生成消息，因为昵称已更改
    await this.clearPregeneratedMessages(context.userId, context.supabase);

    const toolResultContent = {
      type: MessageType.TOOL_RESULT, // 使用枚举值确保匹配
      tool_call_id: toolCallId,
      status: 'success',
      message: `昵称已设置为 ${params.nickname}`
    };

    console.log('Saving tool result message:', toolResultContent);

    // 验证JSON是否有效
    const toolResultJson = JSON.stringify(toolResultContent);
    try {
      const parsed = JSON.parse(toolResultJson);
      console.log('Validated tool result JSON can be parsed back:', parsed);
    } catch (e) {
      console.error('Invalid tool result JSON:', e);
    }

    // 保存工具调用结果消息 - 确保使用tool角色和正确的tool_call_id
    let savedResultMessage: ChatMessage;

    if (context.saveMessage) {
      // 如果有自定义的saveMessage方法，使用它
      savedResultMessage = await context.saveMessage(toolResultJson, 'tool');

      // 确保设置tool_call_id字段，这对于大模型理解工具调用结果至关重要
      await context.supabase
        .from('chat_messages')
        .update({ tool_call_id: toolCallId })
        .eq('id', savedResultMessage.id);
    } else {
      // 直接使用supabase保存消息
      const { data, error } = await context.supabase
        .from('chat_messages')
        .insert([
          {
            content: toolResultJson,
            role: 'tool',
            user_id: context.userId,
            thread_id: context.threadId,
            send_to_llm: true, // 必须发送给大模型
            tool_call_id: toolCallId // 设置工具调用ID，这对于大模型理解工具调用结果至关重要
          },
        ])
        .select()
        .single();

      if (error) throw error;
      savedResultMessage = data;
    }

    console.log('Saved tool result message:', savedResultMessage);

    // 发布工具调用结果事件，确保ToolResultEventHandler能处理它
    try {
      const { getMessageEventBus } = await import('../messaging/MessageEventBus');
      const { MessageEventType } = await import('../../types/messaging');

      const eventBus = getMessageEventBus();
      console.log('[NicknameHandler] Publishing tool result event for tool call ID:', toolCallId);

      eventBus.publish({
        type: MessageEventType.TOOL_RESULT_SENT,
        data: {
          threadId: context.threadId,
          userId: context.userId,
          toolResult: {
            toolCallId: toolCallId,
            status: 'success',
            result: { nickname: params.nickname },
            message: `昵称已设置为 ${params.nickname}`
          },
          messageId: savedResultMessage.id
        }
      });

      console.log('[NicknameHandler] Tool result event published successfully');
    } catch (error) {
      console.error('[NicknameHandler] Failed to publish tool result event:', error);
    }

    messages.push(savedResultMessage);
  }

  private async handleClearNickname(
    context: MessageContext,
    messages: ChatMessage[],
    toolCallId: string
  ): Promise<void> {
    const { error } = await context.supabase
      .from('users')
      .update({ nickname: null })
      .eq('id', context.userId);

    if (error) throw error;

    // 清除用户的预生成消息，因为昵称已清除
    await this.clearPregeneratedMessages(context.userId, context.supabase);

    const toolResultContent = {
      type: MessageType.TOOL_RESULT, // 使用枚举值确保匹配
      tool_call_id: toolCallId,
      status: 'success',
      message: '昵称已清除'
    };

    console.log('Saving clear nickname tool result message:', toolResultContent);

    // 验证JSON是否有效
    const toolResultJson = JSON.stringify(toolResultContent);
    try {
      const parsed = JSON.parse(toolResultJson);
      console.log('Validated clear nickname tool result JSON can be parsed back:', parsed);
    } catch (e) {
      console.error('Invalid clear nickname tool result JSON:', e);
    }

    // 保存工具调用结果消息 - 确保使用tool角色和正确的tool_call_id
    let savedResultMessage: ChatMessage;

    if (context.saveMessage) {
      // 如果有自定义的saveMessage方法，使用它
      savedResultMessage = await context.saveMessage(toolResultJson, 'tool');

      // 确保设置tool_call_id字段，这对于大模型理解工具调用结果至关重要
      await context.supabase
        .from('chat_messages')
        .update({ tool_call_id: toolCallId })
        .eq('id', savedResultMessage.id);
    } else {
      // 直接使用supabase保存消息
      const { data, error } = await context.supabase
        .from('chat_messages')
        .insert([
          {
            content: toolResultJson,
            role: 'tool',
            user_id: context.userId,
            thread_id: context.threadId,
            send_to_llm: true, // 必须发送给大模型
            tool_call_id: toolCallId // 设置工具调用ID，这对于大模型理解工具调用结果至关重要
          },
        ])
        .select()
        .single();

      if (error) throw error;
      savedResultMessage = data;
    }

    console.log('Saved clear nickname tool result message:', savedResultMessage);

    // 发布工具调用结果事件，确保ToolResultEventHandler能处理它
    try {
      const { getMessageEventBus } = await import('../messaging/MessageEventBus');
      const { MessageEventType } = await import('../../types/messaging');

      const eventBus = getMessageEventBus();
      console.log('[NicknameHandler] Publishing clear nickname tool result event for tool call ID:', toolCallId);

      eventBus.publish({
        type: MessageEventType.TOOL_RESULT_SENT,
        data: {
          threadId: context.threadId,
          userId: context.userId,
          toolResult: {
            toolCallId: toolCallId,
            status: 'success',
            result: { nickname: null },
            message: '昵称已清除'
          },
          messageId: savedResultMessage.id
        }
      });

      console.log('[NicknameHandler] Clear nickname tool result event published successfully');
    } catch (error) {
      console.error('[NicknameHandler] Failed to publish clear nickname tool result event:', error);
    }

    messages.push(savedResultMessage);
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
