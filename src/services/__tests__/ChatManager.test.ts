import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ChatManager } from '../ChatManager';
import { supabase } from '../../lib/supabase';
import { getChatService } from '../ChatService';
import { DEFAULT_THREAD_TITLE } from '../../constants/chat';
import { IMessageRepository } from '../../repositories/IMessageRepository';
import { IThreadRepository } from '../../repositories/IThreadRepository';
import { ChatMessage } from '../../types/chat';
import { Thread } from '../../types/threads';

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => {
          return {
            single: vi.fn(() => ({
              data: { created_at: new Date().toISOString(), title: DEFAULT_THREAD_TITLE },
              error: null
            })),
            order: vi.fn(() => ({
              ascending: vi.fn(() => ({
                data: [],
                error: null
              }))
            }))
          };
        }),
        order: vi.fn(() => ({
          ascending: vi.fn(() => ({
            data: [],
            error: null
          }))
        }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: {
              id: '1',
              content: 'test message',
              role: 'user',
              created_at: new Date().toISOString()
            },
            error: null
          }))
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { title: 'Generated Title' },
              error: null
            }))
          }))
        }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: null,
          error: null
        }))
      }))
    }))
  }
}));

// Mock Chat Service
vi.mock('../ChatService', () => ({
  getChatService: vi.fn(() => ({
    sendMessage: vi.fn()
  }))
}));

// Mock prompts
vi.mock('../../constants/prompts', () => ({
  SYSTEM_PROMPT: 'You are a helpful assistant.',
  TITLE_GENERATION_SYSTEM_PROMPT: 'You are a specialized assistant for generating conversation titles.'
}));

// 创建模拟存储库
class MockMessageRepository implements IMessageRepository {
  async getMessages(_threadId: string, _includeHidden: boolean = false): Promise<{ messages: ChatMessage[], error: string | null }> {
    return { messages: [], error: null };
  }

  async saveMessage(
    content: string,
    role: 'user' | 'assistant',
    userId: string,
    threadId: string
  ): Promise<ChatMessage> {
    return {
      id: '1',
      content,
      role,
      user_id: userId,
      thread_id: threadId,
      created_at: new Date().toISOString()
    };
  }

  async createWelcomeMessage(userId: string, threadId: string): Promise<ChatMessage | null> {
    return {
      id: 'welcome-msg',
      content: '欢迎来到新对话！我能为您提供什么帮助？',
      role: 'assistant',
      user_id: userId,
      thread_id: threadId,
      created_at: new Date().toISOString()
    };
  }

  async clearMessages(_threadId: string): Promise<void> {}
}

class MockThreadRepository implements IThreadRepository {
  async getThread(_threadId: string): Promise<{
    thread: { title: string | null, created_at: string } | null,
    error: string | null
  }> {
    return {
      thread: { title: DEFAULT_THREAD_TITLE, created_at: new Date().toISOString() },
      error: null
    };
  }

  async updateThreadTitle(_threadId: string, title: string): Promise<{
    thread: { title: string | null } | null,
    error: string | null
  }> {
    return { thread: { title }, error: null };
  }

  async getThreads(): Promise<{
    threads: Thread[] | null,
    error: string | null
  }> {
    return {
      threads: [{ id: 'test-thread-id', title: DEFAULT_THREAD_TITLE, updated_at: new Date().toISOString() }],
      error: null
    };
  }

  async checkConnection(): Promise<boolean> {
    return true;
  }

  async createThreadWithPregenerated(_userId: string): Promise<string> {
    return 'test-thread-id';
  }

  async createChatThread(): Promise<string> {
    return 'test-thread-id';
  }
}

describe('ChatManager', () => {
  const userId = 'test-user-id';
  const threadId = 'test-thread-id';
  let chatManager: ChatManager;
  let mockSupabaseFrom: ReturnType<typeof vi.fn>;
  let mockChatService: { sendMessage: ReturnType<typeof vi.fn> };
  let mockMessageRepository: IMessageRepository;
  let mockThreadRepository: IThreadRepository;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock window object
    global.window = {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as unknown as Window & typeof globalThis;

    // 创建模拟存储库
    mockMessageRepository = new MockMessageRepository();
    mockThreadRepository = new MockThreadRepository();

    // 使用模拟存储库初始化 ChatManager
    chatManager = new ChatManager(userId, threadId, mockMessageRepository, mockThreadRepository);

    // Get mock references
    mockSupabaseFrom = supabase.from as unknown as ReturnType<typeof vi.fn>;
    mockChatService = getChatService() as unknown as { sendMessage: ReturnType<typeof vi.fn> };

    // Mock dispatchEvent
    vi.spyOn(window, 'dispatchEvent');

    // 为模拟存储库添加 spy
    vi.spyOn(mockMessageRepository, 'getMessages');
    vi.spyOn(mockMessageRepository, 'saveMessage');
    vi.spyOn(mockMessageRepository, 'createWelcomeMessage');
    vi.spyOn(mockMessageRepository, 'clearMessages');
    vi.spyOn(mockThreadRepository, 'getThread');
    vi.spyOn(mockThreadRepository, 'getThreads');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadMessages', () => {
    it('should load existing messages for a thread', async () => {
      const mockMessages: ChatMessage[] = [
        {
          id: '1',
          content: 'Hello',
          role: 'user',
          created_at: new Date().toISOString(),
          thread_id: threadId,
          user_id: userId
        },
        {
          id: '2',
          content: 'Hi there!',
          role: 'assistant',
          created_at: new Date().toISOString(),
          thread_id: threadId,
          user_id: userId
        }
      ];

      // 模拟线程存储库返回线程信息
      vi.mocked(mockThreadRepository.getThread).mockResolvedValueOnce({
        thread: {
          created_at: new Date(Date.now() - 10000).toISOString(),
          title: 'Test Thread'
        },
        error: null
      });

      // 模拟消息存储库返回消息列表（无论是否包含隐藏消息）
      vi.mocked(mockMessageRepository.getMessages).mockImplementation((_threadId, _includeHidden) => {
        return Promise.resolve({
          messages: mockMessages,
          error: null
        });
      });

      const result = await chatManager.loadMessages();
      expect(result.messages).toEqual(mockMessages);
      expect(result.error).toBeNull();
    });

    it('should create welcome message for new thread', async () => {
      // 模拟线程存储库返回线程信息
      vi.mocked(mockThreadRepository.getThread).mockResolvedValueOnce({
        thread: {
          created_at: new Date().toISOString(),
          title: DEFAULT_THREAD_TITLE
        },
        error: null
      });

      // 模拟消息存储库返回空消息列表（无论是否包含隐藏消息）
      vi.mocked(mockMessageRepository.getMessages).mockImplementation((_threadId, _includeHidden) => {
        return Promise.resolve({
          messages: [],
          error: null
        });
      });

      // 模拟创建欢迎消息
      const welcomeMessage = {
        id: 'welcome-msg',
        content: '欢迎来到新对话！我能为您提供什么帮助？',
        role: 'assistant' as const,
        user_id: userId,
        thread_id: threadId,
        created_at: new Date().toISOString()
      };

      vi.mocked(mockMessageRepository.createWelcomeMessage).mockResolvedValueOnce(welcomeMessage);

      const result = await chatManager.loadMessages();
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toBe('欢迎来到新对话！我能为您提供什么帮助？');
      expect(result.messages[0].role).toBe('assistant');
      expect(mockMessageRepository.createWelcomeMessage).toHaveBeenCalledWith(userId, threadId);
    });

    it('should handle errors when loading messages', async () => {
      // 模拟线程存储库返回错误
      vi.mocked(mockThreadRepository.getThread).mockResolvedValueOnce({
        thread: null,
        error: 'Failed to load thread'
      });

      const result = await chatManager.loadMessages();
      expect(result.messages).toEqual([]);
      expect(result.error).toBe('Failed to load thread');
    });

    it('should handle errors when loading messages from message repository', async () => {
      // 模拟线程存储库返回正常结果
      vi.mocked(mockThreadRepository.getThread).mockResolvedValueOnce({
        thread: {
          created_at: new Date().toISOString(),
          title: DEFAULT_THREAD_TITLE
        },
        error: null
      });

      // 模拟消息存储库返回错误（无论是否包含隐藏消息）
      vi.mocked(mockMessageRepository.getMessages).mockImplementation((_threadId, _includeHidden) => {
        return Promise.resolve({
          messages: [],
          error: 'Failed to load messages'
        });
      });

      const result = await chatManager.loadMessages();
      expect(result.messages).toEqual([]);
      expect(result.error).toBe('Failed to load messages');
    });
  });

  describe('sendMessage', () => {
    it('should handle simple text message exchange', async () => {
      const userMessage = 'Hello';
      const aiResponse = 'Hi there!';
      const createdAt = new Date().toISOString();

      // 模拟保存用户消息
      const userMessageObj: ChatMessage = {
        id: '1',
        content: userMessage,
        role: 'user',
        user_id: userId,
        thread_id: threadId,
        created_at: createdAt
      };
      vi.mocked(mockMessageRepository.saveMessage).mockResolvedValueOnce(userMessageObj);

      // 模拟 AI 响应
      vi.mocked(mockChatService.sendMessage).mockResolvedValueOnce({
        role: 'assistant',
        content: aiResponse,
        tool_calls: []
      });

      // 模拟保存 AI 消息
      const aiMessageObj: ChatMessage = {
        id: '2',
        content: aiResponse,
        role: 'assistant',
        user_id: userId,
        thread_id: threadId,
        created_at: createdAt
      };
      vi.mocked(mockMessageRepository.saveMessage).mockResolvedValueOnce(aiMessageObj);

      // 模拟获取线程列表
      vi.mocked(mockThreadRepository.getThreads).mockResolvedValueOnce({
        threads: [{ id: threadId, title: 'Test Thread', updated_at: new Date().toISOString() }],
        error: null
      });

      const messages = await chatManager.sendMessage(userMessage);
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe(userMessage);
      expect(messages[1].content).toBe(aiResponse);
      expect(mockMessageRepository.saveMessage).toHaveBeenCalledTimes(2);
      expect(mockThreadRepository.getThreads).toHaveBeenCalledTimes(1);
    });

    it('should handle multi-part AI responses', async () => {
      const userMessage = 'What is my nickname?';
      const aiResponse = JSON.stringify({
        type: 'multi_part',
        parts: [
          {
            type: 'data_request',
            fields: ['nickname']
          },
          {
            type: 'text',
            content: 'Let me check your nickname.'
          }
        ]
      });

      // Mock saving user message
      mockSupabaseFrom.mockImplementationOnce(() => ({
        insert: () => ({
          select: () => ({
            single: () => ({
              data: {
                id: '1',
                content: userMessage,
                role: 'user',
                created_at: new Date().toISOString()
              }
            })
          })
        })
      }));

      // Mock AI response
      mockChatService.sendMessage.mockResolvedValueOnce({
        role: 'assistant',
        content: aiResponse,
        tool_calls: []
      });

      // Mock saving multi-part message and responses
      for (let i = 0; i < 3; i++) {
        mockSupabaseFrom.mockImplementationOnce(() => ({
          insert: () => ({
            select: () => ({
              single: () => ({
                data: {
                  id: String(i + 2),
                  content: 'mock content',
                  role: 'assistant',
                  created_at: new Date().toISOString()
                }
              })
            })
          })
        }));
      }

      // Mock thread update
      mockSupabaseFrom.mockImplementationOnce(() => ({
        select: () => ({
          order: () => ({
            ascending: () => ({ data: [] })
          })
        })
      }));

      const messages = await chatManager.sendMessage(userMessage);
      expect(messages.length).toBeGreaterThan(1);
      expect(messages[0].content).toBe(userMessage);
    });

    it('should handle errors during message sending', async () => {
      const userMessage = 'Hello';

      // Mock error when saving user message
      mockSupabaseFrom.mockImplementationOnce(() => ({
        insert: () => ({
          select: () => {
            throw new Error('Database error');
          }
        })
      }));

      const messages = await chatManager.sendMessage(userMessage);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].content).toBe(userMessage);
    });
  });

  describe('clearMessages', () => {
    it('should clear all messages in the thread', async () => {
      // 模拟清除消息
      vi.mocked(mockMessageRepository.clearMessages).mockResolvedValueOnce();

      await chatManager.clearMessages();
      expect(chatManager.getMessages()).toHaveLength(0);
      expect(mockMessageRepository.clearMessages).toHaveBeenCalledWith(threadId);
    });

    it('should handle errors when clearing messages', async () => {
      // 模拟清除消息时出错
      vi.mocked(mockMessageRepository.clearMessages).mockRejectedValueOnce(new Error('Database error'));

      await expect(chatManager.clearMessages()).rejects.toThrow('Failed to clear messages');
    });
  });
})
