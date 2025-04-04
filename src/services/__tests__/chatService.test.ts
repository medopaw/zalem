import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ChatService, initializeChatService, getChatService } from '../ChatService';
import type { ChatHistoryMessage } from '../../types/chat';

// Mock window for test environment
const mockWindow = {
  chatServiceInstance: null
};

vi.stubGlobal('window', mockWindow);

describe('ChatService', () => {
  const mockApiKey = 'test-api-key';
  let chatService: ChatService;

  beforeEach(() => {
    chatService = new ChatService(mockApiKey);
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      expect(chatService).toBeInstanceOf(ChatService);
    });

    it('should throw error when API key is missing', () => {
      expect(() => new ChatService('')).toThrow('Missing API key');
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        baseURL: 'https://custom-api.example.com',
        temperature: 0.5,
      };
      const serviceWithConfig = new ChatService(mockApiKey, customConfig);
      expect(serviceWithConfig).toBeInstanceOf(ChatService);
    });
  });

  describe('sendMessage', () => {
    let mockMessages: ChatHistoryMessage[];
    
    beforeEach(() => {
      mockMessages = [
        { role: 'user', content: 'Hello' }
      ];
      global.fetch = vi.fn();
    });

    it('should parse function call format correctly', async () => {
      const functionCallContent = `<fn>setNickname
{"nickname": "小明"}
</fn>`;

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          choices: [{ message: { content: functionCallContent } }]
        }))
      });

      const response = await chatService.sendMessage(mockMessages);
      const parsed = JSON.parse(response);

      expect(parsed).toEqual({
        type: 'tool_call',
        name: 'setNickname',
        parameters: { nickname: '小明' }
      });
    });

    it('should handle function call without parameters', async () => {
      const functionCallContent = `<fn>clearNickname
{}
</fn>`;

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          choices: [{ message: { content: functionCallContent } }]
        }))
      });

      const response = await chatService.sendMessage(mockMessages);
      const parsed = JSON.parse(response);

      expect(parsed).toEqual({
        type: 'tool_call',
        name: 'clearNickname',
        parameters: {}
      });
    });

    it('should throw error for invalid JSON in parameters', async () => {
      const functionCallContent = `<fn>setNickname
{"nickname": "小明" // invalid json
</fn>`;

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          choices: [{ message: { content: functionCallContent } }]
        }))
      });

      await expect(chatService.sendMessage(mockMessages))
        .rejects
        .toThrow('Invalid function parameters: not valid JSON');
    });

    it('should send message and receive response', async () => {
      const mockSuccessResponse = {
        choices: [{ message: { content: 'Hi there!' } }]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockSuccessResponse))
      });

      const response = await chatService.sendMessage(mockMessages);
      expect(response).toBe('Hi there!');
    });

    it('should add system message if missing', async () => {
      const mockSuccessResponse = {
        choices: [{ message: { content: 'Hi there!' } }]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockSuccessResponse))
      });

      await chatService.sendMessage(mockMessages);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      expect(requestBody.messages[0].role).toBe('system');
      expect(requestBody.messages).toHaveLength(2);
    });

    it('should handle API errors', async () => {
      const errorResponse = { error: 'API Error' };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve(JSON.stringify(errorResponse))
      });

      await expect(chatService.sendMessage(mockMessages))
        .rejects
        .toThrow('API Error');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new TypeError('Failed to fetch')
      );

      await expect(chatService.sendMessage(mockMessages))
        .rejects
        .toThrow('Unable to connect to the chat service');
    });

    it('should handle invalid response format', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          invalid: 'response'
        }))
      });

      await expect(chatService.sendMessage(mockMessages))
        .rejects
        .toThrow('Invalid response format from server');
    });
  });
});

describe('Chat Service Initialization', () => {
  let mockSupabase: any;

  beforeEach(() => {
    // Reset chatServiceInstance before each test
    window.chatServiceInstance = null;

    // Create a new mock for each test
    const mockSingle = vi.fn();
    const mockEq = vi.fn(() => ({ single: mockSingle }));
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    const mockFrom = vi.fn(() => ({ select: mockSelect }));

    mockSupabase = { from: mockFrom };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize chat service with API key', async () => {
    const mockSingle = mockSupabase.from().select().eq().single;
    mockSingle.mockResolvedValueOnce({
      data: { value: 'test-api-key' },
      error: null
    });

    const service = await initializeChatService(mockSupabase);
    expect(service).toBeInstanceOf(ChatService);
  });

  it('should throw error when API key retrieval fails', async () => {
    const mockSingle = mockSupabase.from().select().eq().single;
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database error' }
    });

    await expect(initializeChatService(mockSupabase))
      .rejects
      .toThrow('Failed to retrieve DeepSeek API key');
  });

  it('should throw error when getting uninitialized service', () => {
    window.chatServiceInstance = null;

    expect(() => getChatService())
      .toThrow('Chat service not initialized');
  });
});
