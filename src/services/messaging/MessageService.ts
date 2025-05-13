/**
 * 消息服务实现
 *
 * 负责消息的发送、接收和处理
 */

import {
  IMessageService,
  MessageEventType,
  ToolResultData,
  ToolCallData,
  IMessageEventBus
} from '../../types/messaging';
import { IThreadRepository } from '../../repositories/IThreadRepository';
import { getMessageEventBus } from './MessageEventBus';
import { getEventBusProvider } from './EventBusProvider';
import { IMessageRepository } from '../../repositories/IMessageRepository';
import { DatabaseMessage, MessageRole } from '../../types/messageStructures';
import { AIService, getAIService } from '../ai/AIService';


/**
 * 消息服务实现
 */
export class MessageService implements IMessageService {
  private eventBus: IMessageEventBus;
  private aiService: AIService;

  /**
   * 创建消息服务实例
   * @param messageRepository 消息存储库
   * @param threadRepository 线程存储库
   * @param eventBus 事件总线实例，如果不提供则使用全局实例
   * @param aiService AI服务实例，如果不提供则使用全局实例
   */
  constructor(
    private messageRepository: IMessageRepository,
    private threadRepository: IThreadRepository,
    eventBus?: IMessageEventBus,
    aiService?: AIService
  ) {
    // 使用提供的事件总线或从提供者获取
    this.eventBus = eventBus || getEventBusProvider().getEventBus();

    // 使用提供的AI服务或获取全局实例
    this.aiService = aiService || getAIService();

    console.log('[MessageService] Created with event bus and AI service');
  }

  /**
   * 发送用户消息
   * @returns 消息ID
   */
  async sendUserMessage(
    content: string,
    threadId: string,
    userId: string
  ): Promise<string> {
    try {
      // 1. 保存用户消息
      const userMessage = await this.messageRepository.saveMessage(
        content,
        'user',
        userId,
        threadId
      );

      // 2. 发布用户消息事件
      this.eventBus.publish({
        type: MessageEventType.USER_MESSAGE_SENT,
        data: {
          threadId,
          userId,
          content,
          messageId: userMessage.id
        }
      });

      // 3. 获取消息历史
      const { messages } = await this.messageRepository.getLLMHistoryMessages(threadId);

      // 4. 发送消息给大模型
      const assistantResponse = await this.aiService.sendMessage(messages);

      // 5. 处理大模型响应
      await this.handleAssistantResponse(assistantResponse, threadId, userId);

      return userMessage.id;
    } catch (error) {
      console.error('[MessageService] Error sending user message:', error);
      this.eventBus.publish({
        type: MessageEventType.ERROR_OCCURRED,
        data: {
          threadId,
          userId,
          error: error instanceof Error ? error : new Error(String(error)),
          context: 'sendUserMessage'
        }
      });
      throw error;
    }
  }

  /**
   * 发送工具调用结果
   * @returns 消息ID
   */
  async sendToolResult(
    toolResult: ToolResultData,
    threadId: string,
    userId: string
  ): Promise<string> {
    try {
      // 确保工具调用结果处理器已初始化
      this.ensureToolResultHandlerInitialized();

      // 发布工具调用结果事件，让 ToolResultEventHandler 处理
      console.log('[MessageService] Publishing tool result event:', toolResult);

      // 创建工具调用结果内容（仅用于日志）
      const toolResultContent = {
        type: 'tool_result',
        tool_call_id: toolResult.toolCallId,
        status: toolResult.status,
        message: toolResult.message
      };
      console.log('[MessageService] Tool result content:', toolResultContent);

      // 发布事件
      this.eventBus.publish({
        type: MessageEventType.TOOL_RESULT_SENT,
        data: {
          threadId,
          userId,
          toolResult,
          messageId: '' // 消息ID将在保存后设置
        }
      });

      // 返回一个临时ID，实际消息ID将由事件处理器设置
      return `temp-${Date.now()}`;
    } catch (error) {
      console.error('[MessageService] Error sending tool result:', error);
      this.eventBus.publish({
        type: MessageEventType.ERROR_OCCURRED,
        data: {
          threadId,
          userId,
          error: error instanceof Error ? error : new Error(String(error)),
          context: 'sendToolResult'
        }
      });
      throw error;
    }
  }

  /**
   * 确保工具调用结果处理器已初始化
   * 使用新的依赖注入模式初始化事件处理器
   */
  private ensureToolResultHandlerInitialized(): void {
    try {
      // 检查事件总线是否有 TOOL_RESULT_SENT 事件的监听器
      // 使用 MessageEventBus 的 hasListeners 方法
      const eventBusWithMethods = this.eventBus as unknown as {
        hasListeners(eventType: MessageEventType): boolean;
        getRegisteredEventTypes(): MessageEventType[];
      };

      // 检查是否有监听器处理 TOOL_RESULT_SENT 事件
      const hasToolResultListener = typeof eventBusWithMethods.hasListeners === 'function'
        ? eventBusWithMethods.hasListeners(MessageEventType.TOOL_RESULT_SENT)
        : false;

      // 获取所有已注册的事件类型
      const registeredEventTypes = typeof eventBusWithMethods.getRegisteredEventTypes === 'function'
        ? eventBusWithMethods.getRegisteredEventTypes()
        : [];

      console.log('[MessageService] Checking for TOOL_RESULT_SENT listeners:', {
        hasToolResultListener,
        registeredEventTypes
      });

      if (!hasToolResultListener) {
        console.warn('[MessageService] No listeners for TOOL_RESULT_SENT event, attempting to initialize event handlers');

        // 使用新的依赖注入模式初始化事件处理器
        import('../eventHandlers/initEventHandlers').then(module => {
          const { createMessageEventHandlerRegistry } = module;

          try {
            // 创建事件处理器注册表
            const eventHandlerRegistry = createMessageEventHandlerRegistry(
              this.eventBus,
              this.messageRepository,
              this.aiService
            );
            console.log('[MessageService] Created event handler registry');

            // 初始化所有事件处理器
            eventHandlerRegistry.initializeAllHandlers();
            console.log('[MessageService] All event handlers initialized through registry');

            // 为了向后兼容，保留全局引用
            (window as any).__eventHandlerRegistry = eventHandlerRegistry;

            // 检查是否成功初始化
            setTimeout(() => {
              // 检查是否有工具调用结果事件处理器
              const hasListenerAfterInit = typeof eventBusWithMethods.hasListeners === 'function'
                ? eventBusWithMethods.hasListeners(MessageEventType.TOOL_RESULT_SENT)
                : false;

              console.log('[MessageService] Has TOOL_RESULT_SENT listener after initialization:', hasListenerAfterInit);

              if (hasListenerAfterInit) {
                console.log('[MessageService] Successfully initialized ToolResultEventHandler');
              } else {
                console.error('[MessageService] Failed to initialize ToolResultEventHandler, still no listener for TOOL_RESULT_SENT');

                // 尝试单独创建工具调用结果事件处理器
                import('../eventHandlers/ToolResultEventHandler').then(module => {
                  const { createToolResultEventHandler } = module;
                  const toolResultHandler = createToolResultEventHandler(this.messageRepository, this.aiService);
                  console.log('[MessageService] Directly created ToolResultEventHandler:', !!toolResultHandler);
                }).catch(error => {
                  console.error('[MessageService] Failed to directly create ToolResultEventHandler:', error);
                });
              }
            }, 100);
          } catch (error) {
            console.error('[MessageService] Failed to initialize event handlers:', error);

            // 如果使用新方式失败，回退到旧方式
            console.warn('[MessageService] Falling back to legacy event handler initialization');
            import('../eventHandlers/initEventHandlers').then(module => {
              const { initializeEventHandlers } = module;
              try {
                initializeEventHandlers(this.messageRepository, this.aiService);
                console.log('[MessageService] Event handlers initialized using legacy method');
              } catch (fallbackError) {
                console.error('[MessageService] Even legacy initialization failed:', fallbackError);
              }
            }).catch(importError => {
              console.error('[MessageService] Failed to import initEventHandlers:', importError);
            });
          }
        }).catch(error => {
          console.error('[MessageService] Failed to import initEventHandlers:', error);
        });
      } else {
        console.log('[MessageService] ToolResultEventHandler already initialized');
      }
    } catch (error) {
      console.error('[MessageService] Error in ensureToolResultHandlerInitialized:', error);
    }
  }

  /**
   * 获取线程的消息
   */
  async getMessages(
    threadId: string,
    options?: { includeHidden?: boolean; forLLM?: boolean; }
  ): Promise<DatabaseMessage[]> {
    const { messages, error } = await this.messageRepository.getMessages(threadId, options);
    if (error) {
      throw new Error(`Failed to get messages: ${error}`);
    }
    return messages;
  }

  /**
   * 获取线程信息
   */
  async getThread(threadId: string): Promise<{ thread: any | null, error: string | null }> {
    return this.threadRepository.getThread(threadId);
  }

  /**
   * 获取用户的所有线程
   */
  async getThreads(): Promise<{ threads: any[], error: string | null }> {
    const result = await this.threadRepository.getThreads();
    return {
      threads: result.threads || [],
      error: result.error
    };
  }

  /**
   * 更新线程标题
   */
  async updateThreadTitle(threadId: string, title: string): Promise<{ thread: any | null, error: string | null }> {
    return this.threadRepository.updateThreadTitle(threadId, title);
  }

  /**
   * 处理大模型响应
   */
  private async handleAssistantResponse(
    response: any,
    threadId: string,
    userId: string
  ): Promise<void> {
    if (!response) {
      console.warn('[MessageService] Empty assistant response');
      return;
    }

    try {
      // 1. 保存助手消息内容（如果有）
      let assistantMessageId: string | undefined;

      if (response.content) {
        const assistantMessage = await this.messageRepository.saveMessage(
          response.content,
          'assistant',
          userId,
          threadId
        );

        assistantMessageId = assistantMessage.id;

        // 发布助手消息事件
        this.eventBus.publish({
          type: MessageEventType.ASSISTANT_MESSAGE_RECEIVED,
          data: {
            threadId,
            userId,
            content: response.content,
            messageId: assistantMessage.id
          }
        });
      }

      // 2. 处理工具调用（如果有）
      if (response.tool_calls && response.tool_calls.length > 0) {
        // 保存工具调用消息
        const toolCallsContent = {
          type: 'tool_calls',
          calls: response.tool_calls.map((call: any) => ({
            id: call.id,
            name: call.function.name,
            parameters: JSON.parse(call.function.arguments)
          }))
        };

        const toolCallsMessage = await this.messageRepository.saveMessage(
          toolCallsContent,
          'assistant',
          userId,
          threadId
        );

        assistantMessageId = assistantMessageId || toolCallsMessage.id;

        // 处理每个工具调用
        for (const call of response.tool_calls) {
          const toolCall: ToolCallData = {
            id: call.id,
            name: call.function.name,
            arguments: JSON.parse(call.function.arguments)
          };

          // 发布工具调用事件
          this.eventBus.publish({
            type: MessageEventType.TOOL_CALL_RECEIVED,
            data: {
              threadId,
              userId,
              toolCall,
              messageId: toolCallsMessage.id
            }
          });

          // 工具调用的处理已经移至 ToolCallEventHandler
          // 这里只负责发布事件，不再直接处理工具调用
        }
      }

      // 3. 发布消息更新事件
      const { messages } = await this.messageRepository.getMessages(threadId);
      this.eventBus.publish({
        type: MessageEventType.MESSAGES_UPDATED,
        data: {
          threadId,
          userId,
          messages
        }
      });

    } catch (error) {
      console.error('[MessageService] Error handling assistant response:', error);
      this.eventBus.publish({
        type: MessageEventType.ERROR_OCCURRED,
        data: {
          threadId,
          userId,
          error: error instanceof Error ? error : new Error(String(error)),
          context: 'handleAssistantResponse'
        }
      });
    }
  }


}

// 导出工厂函数
export function createMessageService(
  messageRepository: IMessageRepository,
  threadRepository: IThreadRepository,
  aiService?: AIService,
  eventBus?: IMessageEventBus
): IMessageService {
  return new MessageService(
    messageRepository,
    threadRepository,
    eventBus,
    aiService
  );
}
