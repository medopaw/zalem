import { BaseHandler } from './BaseHandler';
import type { MessageContext, ChatMessage } from '../../types/messages';

/**
 * Handles plain text messages
 */
export class TextHandler extends BaseHandler {
  canHandle(message: LLMMessage): boolean {
    return !!message.content;
  }

  async handle(message: LLMMessage, context: MessageContext): Promise<ChatMessage[]> {
    return [await this.saveMessage(message.content || '', 'assistant', context)];
  }
}