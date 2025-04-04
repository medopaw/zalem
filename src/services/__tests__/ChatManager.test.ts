import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ChatManager } from '../ChatManager';
import { supabase } from '../../lib/supabase';
import { getChatService } from '../chatService';
import { DEFAULT_THREAD_TITLE } from '../../constants/chat';

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
vi.mock('../chatService', () => ({
  getChatService: vi.fn(() => ({
    sendMessage: vi.fn()
  })),
  SYSTEM_PROMPT: 'You are a helpful assistant.'
}));

describe('ChatManager', () => {
  const userId = 'test-user-id';
  const threadId = 'test-thread-id';
  let chatManager: ChatManager;
  let mockSupabaseFrom: any;
  let mockChatService: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock window object
    global.window = {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as any;
    
    // Initialize ChatManager
    chatManager = new ChatManager(userId, threadId);
    
    // Get mock references
    mockSupabaseFrom = supabase.from as unknown as ReturnType<typeof vi.fn>;
    mockChatService = getChatService();

    // Mock dispatchEvent
    vi.spyOn(window, 'dispatchEvent');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadMessages', () => {
    it('should load existing messages for a thread', async () => {
      const mockMessages = [
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

      // Mock thread check
      mockSupabaseFrom.mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            single: () => ({ 
              data: { 
                created_at: new Date(Date.now() - 10000).toISOString(),
                title: 'Test Thread'
              },
              error: null
            })
          })
        })
      }));

      // Mock messages fetch
      mockSupabaseFrom.mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            order: () => ({ 
              data: mockMessages,
              error: null
            })
          })
        })
      }));

      const messages = await chatManager.loadMessages();
      expect(messages).toEqual(mockMessages);
    });

    it('should create welcome message for new thread', async () => {
      const mockNickname = 'Test User';
      const createdAt = new Date().toISOString();

      // Mock thread check - new thread
      mockSupabaseFrom.mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            single: () => ({ data: { created_at: new Date().toISOString() } })
          })
        })
      }));

      // Mock empty messages
      mockSupabaseFrom.mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            order: () => ({ data: [] })
          })
        })
      }));

      // Mock user nickname fetch
      mockSupabaseFrom.mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            single: () => ({ data: { nickname: mockNickname } })
          })
        })
      }));

      // Mock welcome message save
      mockSupabaseFrom.mockImplementationOnce(() => ({
        insert: () => ({
          select: () => ({
            single: () => ({
              data: {
                id: 'welcome-msg',
                content: `欢迎回来，${mockNickname}！您在忙什么呢？`,
                role: 'assistant',
                created_at: createdAt
              }
            })
          })
        })
      }));

      const messages = await chatManager.loadMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toContain(mockNickname);
      expect(messages[0].role).toBe('assistant');
    });

    it('should handle errors when loading messages', async () => {
      mockSupabaseFrom.mockImplementationOnce(() => ({
        select: () => ({
          eq: () => {
            throw new Error('Database error');
          }
        })
      }));

      await expect(chatManager.loadMessages()).rejects.toThrow('Failed to load messages');
    });
  });

  describe('sendMessage', () => {
    it('should handle simple text message exchange', async () => {
      const userMessage = 'Hello';
      const aiResponse = 'Hi there!';
      const createdAt = new Date().toISOString();

      // Mock saving user message
      mockSupabaseFrom.mockImplementationOnce(() => ({
        insert: () => ({
          select: () => ({
            single: () => ({
              data: {
                id: '1',
                content: userMessage,
                role: 'user',
                created_at: createdAt
              }
            })
          })
        })
      }));

      // Mock AI response
      mockChatService.sendMessage.mockResolvedValueOnce(aiResponse);

      // Mock saving AI message
      mockSupabaseFrom.mockImplementationOnce(() => ({
        insert: () => ({
          select: () => ({
            single: () => ({
              data: {
                id: '2',
                content: aiResponse,
                role: 'assistant',
                created_at: createdAt
              }
            })
          })
        })
      }));

      // Mock thread update
      mockSupabaseFrom.mockImplementationOnce(() => ({
        select: () => ({
          order: () => ({
            ascending: () => ({ data: [] })
          })
        })
      }));

      const messages = await chatManager.sendMessage(userMessage);
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe(userMessage);
      expect(messages[1].content).toBe(aiResponse);
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
      mockChatService.sendMessage.mockResolvedValueOnce(aiResponse);

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

      await expect(chatManager.sendMessage(userMessage)).rejects.toThrow();
    });
  });

  describe('clearMessages', () => {
    it('should clear all messages in the thread', async () => {
      mockSupabaseFrom.mockImplementationOnce(() => ({
        delete: () => ({
          eq: () => ({ error: null })
        })
      }));

      await chatManager.clearMessages();
      expect(chatManager.getMessages()).toHaveLength(0);
    });

    it('should handle errors when clearing messages', async () => {
      mockSupabaseFrom.mockImplementationOnce(() => ({
        delete: () => ({
          eq: () => {
            throw new Error('Database error');
          }
        })
      }));

      await expect(chatManager.clearMessages()).rejects.toThrow('Failed to clear messages');
    });
  });
})