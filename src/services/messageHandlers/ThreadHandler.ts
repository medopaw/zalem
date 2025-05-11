import { BaseHandler } from './BaseHandler';
import type { MessageContext, ChatMessage } from '../../types/messages';
import type { ThreadUpdatedEventDetail } from '../../types/events';
import type { LLMMessage } from '../../types/chat';
import { MessageType } from '../../utils/MessageTypeRegistry';

/**
 * @deprecated 此处理器已被弃用，但为了向后兼容而保留。
 * 新的标题生成机制使用 AIService.generateTitle 方法。
 */
export class ThreadHandler extends BaseHandler {
  canHandle(message: LLMMessage): boolean {
    if (!message.tool_calls || message.tool_calls.length === 0) return false;

    // Check if any tool call is for set_thread_title
    return message.tool_calls.some(tool =>
      tool.function && tool.function.name === 'set_thread_title'
    );
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
      const toolCallsContent = {
        type: MessageType.TOOL_CALLS, // 使用枚举值确保匹配
        calls: message.tool_calls.map(call => ({
          id: call.id,
          name: call.function.name,
          parameters: JSON.parse(call.function.arguments)
        }))
      };

      // 保存工具调用消息
      messages.push(await this.saveMessage(
        JSON.stringify(toolCallsContent),
        'tool', // 使用tool角色保持一致性
        context
      ));
    }

    // Find the set_thread_title tool call
    const threadTitleCall = message.tool_calls?.find(tool =>
      tool.function && tool.function.name === 'set_thread_title'
    );

    if (!threadTitleCall || !threadTitleCall.function) {
      return messages;
    }

    // Parse the arguments
    let title: string;
    try {
      const args = JSON.parse(threadTitleCall.function.arguments);
      title = args.title;
      if (!title) throw new Error('Missing title parameter');
    } catch (error) {
      console.error('Error parsing thread title arguments:', error);
      return messages;
    }

    // Update thread title
    const { data: updatedThread, error } = await context.supabase
      .from('chat_threads')
      .update({ title })
      .eq('id', context.threadId)
      .select()
      .single();

    if (error) throw error;

    // Fetch updated threads list
    const { data: threads } = await context.supabase
      .from('chat_threads')
      .select('*')
      .order('updated_at', { ascending: false })
      .throwOnError();

    console.log('Updated thread:', updatedThread);
    console.log('Updated threads list:', threads);

    // Broadcast thread update event
    const event = new CustomEvent<ThreadUpdatedEventDetail>('thread-updated', {
      detail: { threads }
    });
    console.log('Dispatching thread-updated event:', event);
    window.dispatchEvent(event);

    // Save success message
    messages.push(await this.saveMessage(
      JSON.stringify({
        type: MessageType.TOOL_RESULT, // 使用枚举值确保匹配
        tool_call_id: threadTitleCall.id,
        status: 'success',
        message: `已将会话标题设置为"${title}"`
      }),
      'tool', // 使用tool角色保持一致性
      context
    ));

    return messages;
  }
}
