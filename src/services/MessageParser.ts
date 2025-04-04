import { TextHandler } from './messageHandlers/TextHandler';
import { DataRequestHandler } from './messageHandlers/DataRequestHandler';
import { NicknameHandler } from './messageHandlers/NicknameHandler';
import { TaskHandler } from './messageHandlers/TaskHandler';
import { ThreadHandler } from './messageHandlers/ThreadHandler';
import type { MessageHandler, MessageContext, ChatMessage, LLMMessage } from '../types/messages';

/**
 * Simple message parser that handles plain text messages only
 */
export class MessageParser {
  private handlers: MessageHandler[];

  constructor() {
    this.handlers = [
      new DataRequestHandler(),
      new NicknameHandler(),
      new TaskHandler(),
      new ThreadHandler(),
      new TextHandler() // Fallback handler
    ];
  }

  /**
   * Parse and handle a plain text message
   */
  async parseMessage(    
    llmMessage: LLMMessage,
    context: MessageContext
  ): Promise<ChatMessage[]> {
    console.log('Parsing LLM message:', llmMessage);
    
    const messages: ChatMessage[] = [];

    // Save initial content if present
    if (llmMessage.content) {
      for (const handler of this.handlers) {
        if (handler.canHandle(llmMessage)) {
          const handlerMessages = await handler.handle(llmMessage, context);
          messages.push(...handlerMessages);
        }
      }
    }
    
    // Handle tool calls first if present
    if (llmMessage.tool_calls?.length) {
      for (const handler of this.handlers) {
        if (handler.canHandle(llmMessage)) {
          const handlerMessages = await handler.handle(llmMessage, context);
          messages.push(...handlerMessages);
        }
      }
    }
    
    return messages;
  }
}