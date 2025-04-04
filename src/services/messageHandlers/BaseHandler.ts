import type { MessageHandler, MessageContext, ChatMessage } from '../../types/messages';
import type { LLMMessage } from '../../types/chat';

/**
 * Base class for message handlers with common functionality
 */
export abstract class BaseHandler implements MessageHandler {
  abstract canHandle(message: LLMMessage): boolean;
  abstract handle(message: LLMMessage, context: MessageContext): Promise<ChatMessage[]>;

  /**
   * Save a message to the database
   */
  protected async saveMessage(
    content: string,
    role: 'user' | 'assistant',
    context: MessageContext & { saveMessage?: (content: string, role: 'user' | 'assistant') => Promise<ChatMessage> }
  ): Promise<ChatMessage> {
    if (context.saveMessage) {
      return context.saveMessage(content, role);
    }

    const { data, error } = await context.supabase
      .from('chat_messages')
      .insert([
        {
          content,
          role,
          user_id: context.userId,
          thread_id: context.threadId
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
