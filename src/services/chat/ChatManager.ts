import { ChatMessage, ChatHistoryMessage } from '../../types/chat';
import { MessageRole } from '../../types/messageTypes';
import { MessageParser } from '../MessageParser';
import { getChatService } from '../ChatService';
import { SYSTEM_PROMPT } from '../../constants/prompts';
import type { MessageContext } from '../../types/messages';
import type { ThreadUpdatedEventDetail } from '../../types/events';
import { DEFAULT_THREAD_TITLE } from '../../constants/chat';
import { IMessageRepository } from '../../repositories/IMessageRepository';
import { IThreadRepository } from '../../repositories/IThreadRepository';
import { SupabaseMessageRepository } from '../../repositories/SupabaseMessageRepository';
import { SupabaseThreadRepository } from '../../repositories/SupabaseThreadRepository';
import { supabase } from '../../lib/supabase';

const HISTORY_LIMIT = 10;
const MESSAGES_FOR_TITLE = 5;

/**
 * 管理聊天会话的核心类
 * 负责消息的发送、接收和处理
 */
export class ChatManager {
  private messageParser: MessageParser;
  private userId: string;
  private threadId: string;
  private pendingThreadId: string | null = null;
  private messages: ChatMessage[] = [];
  private threadTitle: string | null = DEFAULT_THREAD_TITLE;
  private titleGenerated: boolean = false;
  private initialized: boolean = false;
  private messageRepository: IMessageRepository;
  private threadRepository: IThreadRepository;

  /**
   * 创建一个新的聊天管理器实例
   * @param userId 用户ID
   * @param threadId 会话ID
   * @param messageRepo 可选的消息存储库实现
   * @param threadRepo 可选的会话存储库实现
   */
  constructor(userId: string, threadId: string,
              messageRepo?: IMessageRepository,
              threadRepo?: IThreadRepository) {
    this.userId = userId;
    this.threadId = threadId;
    this.messageParser = new MessageParser();
    this.initialized = false;
    this.messageRepository = messageRepo || new SupabaseMessageRepository(supabase);
    this.threadRepository = threadRepo || new SupabaseThreadRepository(supabase);
  }

  /**
   * Load messages for the current thread
   */
  async loadMessages(): Promise<{ messages: ChatMessage[], error: string | null }> {
    try {
      // Wait for initialization if needed
      if (!this.initialized) {
        const error = await this.initialize();
        if (error) {
          return { messages: [], error };
        }
      }

      // Check if this is a new thread
      const { thread, error: threadErr } = await this.threadRepository.getThread(this.threadId);

      if (threadErr) {
        return { messages: [], error: threadErr };
      }

      // Update thread title
      this.threadTitle = thread?.title || null;

      // Load existing messages
      const { messages, error } = await this.messageRepository.getMessages(this.threadId);

      if (error) {
        return { messages: [], error };
      }

      // 如果没有消息，则创建欢迎消息
      const hasNoMessages = messages.length === 0;

      // 只在调试模式下输出日志
      if (process.env.NODE_ENV === 'development') {
        console.log('Thread info:', {
          id: this.threadId,
          created_at: thread?.created_at,
          hasNoMessages,
          messageCount: messages.length
        });
      }

      if (hasNoMessages) {
        console.log('No messages found, creating welcome message');
        const welcomeMessage = await this.messageRepository.createWelcomeMessage(
          this.userId,
          this.threadId
        );

        if (welcomeMessage) {
          console.log('Welcome message created:', welcomeMessage);
          this.messages = [welcomeMessage];
        } else {
          console.log('Failed to create welcome message');
          this.messages = [];
        }
        return { messages: this.messages, error: null };
      }

      this.messages = messages;
      return { messages: this.messages, error: null };
    } catch (error) {
      console.error('Error loading messages:', error);
      return { messages: [], error: 'Failed to load messages' };
    }
  }

  /**
   * Initialize the chat manager
   */
  private async initialize(): Promise<string | null> {
    try {
      // Check database connection
      const isConnected = await this.threadRepository.checkConnection();

      if (!isConnected) {
        return 'Failed to connect to the database';
      }

      this.initialized = true;
      return null;
    } catch (error) {
      console.error('Failed to initialize chat manager:', error);
      return 'Failed to connect to the database';
    }
  }

  /**
   * Send a message and handle the response
   */
  async sendMessage(
    content: string
  ): Promise<ChatMessage[]> {
    // Lock the thread ID for this message
    this.pendingThreadId = this.threadId;

    try {
      // 先获取消息历史，再保存用户消息，避免重复
      // Get chat history for context (including hidden messages)
      const baseHistory = await this.prepareChatHistory(true);

      // Save the real user message after getting history
      const userMessage = await this.saveMessage(content, 'user');
      const newMessages = [userMessage];

      // 手动添加当前用户消息
      const chatHistory: ChatHistoryMessage[] = [
        ...baseHistory,
        { role: 'user' as MessageRole, content }
      ];

      // Get AI response
      const chatService = getChatService();
      const assistantMessage = await chatService.sendMessage(chatHistory);
      // console.log('AI Response:', assistantMessage);

      // Create message context
      const context: MessageContext = {
        userId: this.userId,
        supabase, // 暂时保留，后续版本将移除对 supabase 的直接依赖
        chatHistory, // 使用包含隐藏消息的完整消息历史
        chatService,
        threadId: this.pendingThreadId
      };

      // 如果 AI 响应为空，创建一个默认的文本响应
      if (!assistantMessage) {
        const defaultMessage = {
          role: 'assistant',
          content: '抱歉，我无法处理您的请求。请稍后再试。',
          tool_calls: []
        };
        const defaultParsedMessage = await this.saveMessage(defaultMessage.content, 'assistant');
        newMessages.push(defaultParsedMessage);
      } else {
        // Parse and handle the message
        const parsedMessages = await this.messageParser.parseMessage(
          assistantMessage,
          {
            ...context,
            saveMessage: (content: string, role: 'user' | 'assistant') =>
              this.saveMessage(content, role)
          }
        );
        newMessages.push(...parsedMessages);
      }

      // Update internal messages state with all new messages
      this.messages.push(...newMessages);

      // Broadcast thread update
      await this.broadcastThreadUpdate();

      // Check if we should generate a title
      if (!this.titleGenerated && this.messages.length >= MESSAGES_FOR_TITLE) {
        this.titleGenerated = true;
        // Don't wait for title generation
        this.generateAndSetThreadTitle();
      }

      return newMessages;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    } finally {
      // Release the thread ID lock
      this.pendingThreadId = null;
    }
  }

  /**
   * Clear all messages in the current thread
   */
  async clearMessages(): Promise<void> {
    try {
      await this.messageRepository.clearMessages(this.threadId);
      this.messages = [];
    } catch (error) {
      console.error('Error clearing messages:', error);
      throw new Error('Failed to clear messages');
    }
  }

  /**
   * Get all current messages
   */
  getMessages(): ChatMessage[] {
    return this.messages;
  }



  private async saveMessage(
    content: string,
    role: 'user' | 'assistant'
  ): Promise<ChatMessage> {
    const threadId = this.pendingThreadId || this.threadId;
    return this.messageRepository.saveMessage(content, role, this.userId, threadId);
  }

  /**
   * 准备发送给大模型的基础消息历史（不包含当前用户消息）
   * @param includeHidden 是否包含隐藏消息，默认为 true
   * @returns 格式化的消息历史
   */
  private async prepareChatHistory(includeHidden: boolean = true): Promise<ChatHistoryMessage[]> {
    // 获取消息历史，包含隐藏消息
    const { messages } = await this.messageRepository.getMessages(this.threadId, includeHidden);

    const history = messages
      .slice(-HISTORY_LIMIT)
      .map(msg => ({
        role: msg.role as MessageRole,
        content: msg.content
      }));

    // 注意：这里不再添加当前用户消息，因为它将在 sendMessage 方法中手动添加
    return [
      { role: 'system' as MessageRole, content: SYSTEM_PROMPT },
      ...history
    ];
  }

  private async broadcastThreadUpdate(): Promise<void> {
    try {
      const threadId = this.pendingThreadId || this.threadId;
      const { threads } = await this.threadRepository.getThreads();

      if (!threads) {
        console.error('Failed to get threads for broadcast');
        return;
      }

      // Update thread title from the latest data
      const currentThread = threads.find(t => t.id === threadId);
      if (currentThread) {
        this.threadTitle = currentThread.title;
      }

      // 确保 threads 中的 title 不为 null
      const safeThreads = threads.map(t => ({
        ...t,
        title: t.title || ''
      }));

      const event = new CustomEvent<ThreadUpdatedEventDetail>(
        'thread-updated',
        { detail: { threads: safeThreads } }
      );
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Error broadcasting thread update:', error);
    }
  }

  /**
   * 生成并设置对话标题
   * @returns 生成的标题
   */
  private async generateAndSetThreadTitle(): Promise<string> {
    try {
      // 准备对话内容作为标题生成的输入
      // 只使用可见消息生成标题
      const { messages: visibleMessages } = await this.messageRepository.getMessages(this.threadId, false);
      const historyForTitle = visibleMessages
        .slice(0, MESSAGES_FOR_TITLE)
        .map(msg => `${msg.role === 'user' ? '用户' : '助手'}: ${msg.content}`)
        .join('\n');

      // 使用 AI 生成标题
      const chatService = getChatService();
      const title = await chatService.generateTitle(historyForTitle);

      // 更新数据库中的标题
      const threadId = this.pendingThreadId || this.threadId;
      const { thread, error } = await this.threadRepository.updateThreadTitle(threadId, title);

      if (error) {
        console.error('Error updating thread title:', error);
        return DEFAULT_THREAD_TITLE;
      }

      // 更新内存中的标题
      this.threadTitle = thread?.title || DEFAULT_THREAD_TITLE;

      // 广播线程更新
      await this.broadcastThreadUpdate();

      return this.threadTitle;
    } catch (error) {
      console.error('Error generating thread title:', error);
      return DEFAULT_THREAD_TITLE;
    }
  }

  /**
   * Get the current thread title
   * @returns The thread title or null if not set
   */
  getThreadTitle(): string | null {
    return this.threadTitle;
  }
}
