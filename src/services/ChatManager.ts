import { supabase } from '../lib/supabase';
import { ChatMessage, ChatHistoryMessage } from '../types/chat';
import { MessageParser } from './MessageParser';
import { getChatService, SYSTEM_PROMPT } from './ChatService';
import type { MessageContext } from '../types/messages';
import type { ThreadUpdatedEventDetail } from '../types/events';
import { DEFAULT_THREAD_TITLE } from '../constants/chat';

const HISTORY_LIMIT = 10;
const MESSAGES_FOR_TITLE = 5;

export class ChatManager {
  private messageParser: MessageParser;
  private userId: string;
  private threadId: string;
  private pendingThreadId: string | null = null;
  private messages: ChatMessage[] = [];
  private threadTitle: string | null = DEFAULT_THREAD_TITLE;
  private titleGenerated: boolean = false;
  private initialized: boolean = false;

  constructor(userId: string, threadId: string) {
    this.userId = userId;
    this.threadId = threadId;
    this.messageParser = new MessageParser();
    this.initialized = false;
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
      const { data: thread, error: threadErr } = await supabase
        .from('chat_threads')
        .select('created_at, title')
        .eq('id', this.threadId)
        .single();

      if (threadErr) {
        return { messages: [], error: `Failed to load thread ${this.threadId}.\nError: ${threadErr}`};
      }

      // Update thread title
      this.threadTitle = thread?.title || null;

      // Load existing messages
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', this.threadId)
        .order('created_at', { ascending: true });

      if (error) {
        return { messages: [], error: `Failed to load messages.\nError: ${error}` };
      }

      // 如果没有消息，则创建欢迎消息
      const hasNoMessages = !data || data.length === 0;

      // 只在调试模式下输出日志
      if (process.env.NODE_ENV === 'development') {
        console.log('Thread info:', {
          id: this.threadId,
          created_at: thread?.created_at,
          hasNoMessages,
          messageCount: data?.length || 0
        });
      }

      if (hasNoMessages) {
        console.log('No messages found, creating welcome message');
        const welcomeMessage = await this.createWelcomeMessage();
        if (welcomeMessage) {
          console.log('Welcome message created:', welcomeMessage);
          this.messages = [welcomeMessage];
        } else {
          console.log('Failed to create welcome message');
          this.messages = [];
        }
        return { messages: this.messages, error: null };
      }

      this.messages = data || [];
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
      // Check Supabase connection
      const { data, error } = await supabase
        .from('chat_threads')
        .select('id')
        .limit(1);

      if (error) {
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
    content: string,
    addToHistory: boolean = true
  ): Promise<ChatMessage[]> {
    // Lock the thread ID for this message
    this.pendingThreadId = this.threadId;

    try {
      // Save the real user message first
      const userMessage = await this.saveMessage(content, 'user');
      const newMessages = [userMessage];

      // Check if we should generate a title
      let extraSystemPrompt = null;
      if (!this.titleGenerated && this.messages.length >= MESSAGES_FOR_TITLE) {
        this.titleGenerated = true;
        extraSystemPrompt = '请根据以下对话内容生成一个简短的标题（不超过20个字）。标题应该概括对话的主要内容。必须使用 function call 格式设置标题。'
      }
      // Get chat history for context
      const chatHistory = this.prepareChatHistory(content, extraSystemPrompt);

      // Get AI response
      const chatService = getChatService();
      const assistantMessage = await chatService.sendMessage(chatHistory);
      console.log('AI Response:', assistantMessage);

      // Create message context
      const context: MessageContext = {
        userId: this.userId,
        supabase,
        chatHistory,
        chatService,
        threadId: this.pendingThreadId
      };

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

      // Update internal messages state with all new messages
      this.messages.push(...newMessages);

      // Broadcast thread update
      await this.broadcastThreadUpdate();

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
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('thread_id', this.threadId);

      if (error) throw error;
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

  private async createWelcomeMessage(): Promise<ChatMessage | null> {
    try {
      // 直接创建欢迎消息，不查询用户昵称
      const welcomeMessage = "欢迎来到新对话！我能为您提供什么帮助？";
      console.log('Creating welcome message for thread:', this.threadId);

      // 直接向数据库插入消息，不经过其他逻辑
      const { data, error } = await supabase
        .from('chat_messages')
        .insert([{
          content: welcomeMessage,
          role: 'assistant',
          user_id: this.userId,
          thread_id: this.threadId
        }])
        .select()
        .single();

      if (error) {
        console.error('Error saving welcome message:', error);
        return null;
      }

      console.log('Welcome message created successfully:', data);
      return data;
    } catch (error) {
      console.error('Error creating welcome message:', error);
      return null;
    }
  }

  private async saveMessage(
    content: string,
    role: 'user' | 'assistant'
  ): Promise<ChatMessage> {
    const threadId = this.pendingThreadId || this.threadId;

    const { data, error } = await supabase
      .from('chat_messages')
      .insert([{
        content,
        role,
        user_id: this.userId,
        thread_id: threadId
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  private prepareChatHistory(content: string, extraSystemPrompt?: string): ChatHistoryMessage[] {
    const history = this.messages
      .slice(-HISTORY_LIMIT)
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }));

    return extraSystemPrompt ? [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'system', content: extraSystemPrompt },
      { role: 'user', content }
    ] : [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content }
    ];
  }

  private async broadcastThreadUpdate(): Promise<void> {
    try {
      const threadId = this.pendingThreadId || this.threadId;

      const { data: threads } = await supabase
        .from('chat_threads')
        .select('id, title, updated_at')
        .order('updated_at', { ascending: false })
        .throwOnError();

      // Update thread title from the latest data
      const currentThread = threads?.find(t => t.id === threadId);
      if (currentThread) {
        this.threadTitle = currentThread.title;
      }

      const event = new CustomEvent<ThreadUpdatedEventDetail>(
        'thread-updated',
        { detail: { threads: threads || [] } }
      );
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Error broadcasting thread update:', error);
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
