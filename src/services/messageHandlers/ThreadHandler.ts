import { BaseHandler } from './BaseHandler';
import type { MessageContext, ChatMessage, FunctionCallMessage } from '../../types/messages';
import type { ThreadUpdatedEventDetail } from '../../types/events';

export class ThreadHandler extends BaseHandler {
  canHandle(message: string): boolean {
    const parsed = this.parseJSON(message);
    return parsed?.type === 'tool_call' && parsed.name === 'setThreadTitle';
  }

  async handle(message: string, context: MessageContext): Promise<ChatMessage[]> {
    const parsed = this.parseJSON(message) as FunctionCallMessage;
    const { title } = parsed.parameters as { title: string };
    const messages: ChatMessage[] = [];

    // Save the function call message
    messages.push(await this.saveMessage(message, 'assistant', context));

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
        type: 'execution_result',
        status: 'success',
        message: `已将会话标题设置为"${title}"`
      }),
      'assistant',
      context
    ));

    return messages;
  }
}