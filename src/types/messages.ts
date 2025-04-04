import { ChatMessage } from './chat';

import { LLMMessage } from './chat';

/**
 * Interface for message handlers
 */
export interface MessageHandler {
  canHandle(message: LLMMessage): boolean;
  handle(message: LLMMessage, context: MessageContext): Promise<ChatMessage[]>;
}

/**
 * Context provided to message handlers
 */
export interface MessageContext {
  userId: string;
  supabase: any;
  chatHistory: ChatMessage[];
  chatService: any;
  threadId: string;
  saveMessage?: (content: string, role: 'user' | 'assistant') => Promise<ChatMessage>;
}