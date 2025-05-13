/**
 * MessageSender 单元测试
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { MessageSender } from '../MessageSender';
import { IMessageRepository } from '../../../repositories/IMessageRepository';
import { AIService } from '../../ai/AIService';
import { IMessageEventBus, MessageEventType } from '../../../types/messaging';
import { LLMMessage } from '../../../types/messageTypes';
import { DatabaseMessage } from '../../../types/messageStructures';

// 模拟依赖
vi.mock('../../../utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('MessageSender', () => {
  // 模拟依赖
  let mockMessageRepository: IMessageRepository;
  let mockAIService: AIService;
  let mockEventBus: IMessageEventBus;
  let messageSender: MessageSender;

  // 测试数据
  const threadId = 'thread-1';
  const userId = 'user-1';
  const userContent = 'Hello, world!';
  const assistantContent = 'Hello, user!';

  // 模拟消息
  const mockUserMessage: DatabaseMessage = {
    id: 'user-message-1',
    content: userContent,
    role: 'user',
    user_id: userId,
    thread_id: threadId,
    created_at: new Date().toISOString(),
    is_visible: true,
    send_to_llm: true
  };

  const mockAssistantMessage: DatabaseMessage = {
    id: 'assistant-message-1',
    content: assistantContent,
    role: 'assistant',
    user_id: userId,
    thread_id: threadId,
    created_at: new Date().toISOString(),
    is_visible: true,
    send_to_llm: true
  };

  const mockLLMResponse: LLMMessage = {
    role: 'assistant',
    content: assistantContent
  };

  const mockToolCallsResponse: LLMMessage = {
    role: 'assistant',
    content: null,
    tool_calls: [
      {
        id: 'tool-call-1',
        type: 'function',
        function: {
          name: 'test_tool',
          arguments: '{"param1":"value1"}'
        }
      }
    ]
  };

  beforeEach(() => {
    // 重置模拟
    vi.resetAllMocks();

    // 创建模拟依赖
    mockMessageRepository = {
      saveMessage: vi.fn().mockResolvedValue(mockUserMessage),
      getMessages: vi.fn().mockResolvedValue({ messages: [mockUserMessage, mockAssistantMessage], error: null }),
      getLLMHistoryMessages: vi.fn().mockResolvedValue({ messages: [mockUserMessage], error: null }),
      deleteMessage: vi.fn().mockResolvedValue({ error: null }),
      updateMessage: vi.fn().mockResolvedValue({ message: mockUserMessage, error: null })
    };

    mockAIService = {
      sendMessage: vi.fn().mockResolvedValue(mockLLMResponse),
      sendSingleMessage: vi.fn().mockResolvedValue(mockLLMResponse)
    } as unknown as AIService;

    mockEventBus = {
      publish: vi.fn(),
      subscribe: vi.fn().mockReturnValue(() => {}),
      subscribeAll: vi.fn().mockReturnValue(() => {})
    };

    // 创建被测试对象
    messageSender = new MessageSender(
      mockMessageRepository,
      mockAIService,
      mockEventBus
    );
  });

  test('sendToLLM should get messages and send to LLM', async () => {
    // 执行
    const result = await messageSender.sendToLLM(threadId, userId);

    // 验证
    expect(mockMessageRepository.getLLMHistoryMessages).toHaveBeenCalledWith(threadId);
    expect(mockAIService.sendMessage).toHaveBeenCalledWith([mockUserMessage]);
    expect(result).toEqual(mockLLMResponse);
  });

  test('sendUserMessage should save message and send to LLM', async () => {
    // 执行
    const result = await messageSender.sendUserMessage(userContent, threadId, userId);

    // 验证
    expect(mockMessageRepository.saveMessage).toHaveBeenCalledWith(
      userContent,
      'user',
      userId,
      threadId
    );
    expect(mockEventBus.publish).toHaveBeenCalledWith({
      type: MessageEventType.USER_MESSAGE_SENT,
      data: {
        threadId,
        userId,
        content: userContent,
        messageId: mockUserMessage.id
      }
    });
    expect(mockAIService.sendMessage).toHaveBeenCalled();
    expect(result).toEqual(mockUserMessage.id);
  });

  test('sendToolResult should save tool result and send to LLM', async () => {
    // 模拟工具调用结果
    const toolResult = {
      toolCallId: 'tool-call-1',
      status: 'success' as const,
      result: { data: 'test' },
      message: 'Tool executed successfully'
    };

    // 模拟保存工具调用结果消息
    const mockToolResultMessage = {
      id: 'tool-result-1',
      content: JSON.stringify({
        type: 'tool_result',
        tool_call_id: toolResult.toolCallId,
        status: toolResult.status,
        message: toolResult.message
      }),
      role: 'tool',
      user_id: userId,
      thread_id: threadId,
      created_at: new Date().toISOString(),
      is_visible: true,
      send_to_llm: true,
      tool_call_id: toolResult.toolCallId
    };
    mockMessageRepository.saveMessage = vi.fn().mockResolvedValue(mockToolResultMessage);

    // 执行
    const result = await messageSender.sendToolResult(toolResult, threadId, userId);

    // 验证
    expect(mockMessageRepository.saveMessage).toHaveBeenCalledWith(
      expect.any(String),
      'tool',
      userId,
      threadId,
      {
        isVisible: true,
        sendToLLM: true,
        toolCallId: toolResult.toolCallId
      }
    );
    expect(mockEventBus.publish).toHaveBeenCalledWith({
      type: MessageEventType.TOOL_RESULT_SENT,
      data: {
        threadId,
        userId,
        toolResult,
        messageId: mockToolResultMessage.id
      }
    });
    expect(mockAIService.sendMessage).toHaveBeenCalled();
    expect(result).toEqual(mockToolResultMessage.id);
  });

  test('saveAssistantResponse should save text response and publish event', async () => {
    // 模拟保存助手消息
    mockMessageRepository.saveMessage = vi.fn().mockResolvedValue(mockAssistantMessage);

    // 执行
    const result = await messageSender.saveAssistantResponse(mockLLMResponse, threadId, userId);

    // 验证
    expect(mockMessageRepository.saveMessage).toHaveBeenCalledWith(
      assistantContent,
      'assistant',
      userId,
      threadId
    );
    expect(mockEventBus.publish).toHaveBeenCalledWith({
      type: MessageEventType.ASSISTANT_MESSAGE_RECEIVED,
      data: {
        threadId,
        userId,
        content: assistantContent,
        messageId: mockAssistantMessage.id
      }
    });
    expect(mockEventBus.publish).toHaveBeenCalledWith({
      type: MessageEventType.MESSAGES_UPDATED,
      data: {
        threadId,
        userId,
        messages: expect.any(Array)
      }
    });
    expect(result).toEqual(mockAssistantMessage.id);
  });

  test('saveAssistantResponse should save tool calls and publish events', async () => {
    // 模拟保存工具调用消息
    const mockToolCallsMessage = {
      id: 'tool-calls-1',
      content: JSON.stringify({
        type: 'tool_calls',
        tool_calls: [
          {
            id: 'tool-call-1',
            name: 'test_tool',
            arguments: { param1: 'value1' }
          }
        ]
      }),
      role: 'assistant',
      user_id: userId,
      thread_id: threadId,
      created_at: new Date().toISOString(),
      is_visible: true,
      send_to_llm: true
    };
    mockMessageRepository.saveMessage = vi.fn().mockResolvedValue(mockToolCallsMessage);

    // 执行
    const result = await messageSender.saveAssistantResponse(mockToolCallsResponse, threadId, userId);

    // 验证
    expect(mockMessageRepository.saveMessage).toHaveBeenCalledWith(
      expect.any(String),
      'assistant',
      userId,
      threadId
    );
    expect(mockEventBus.publish).toHaveBeenCalledWith({
      type: MessageEventType.TOOL_CALL_RECEIVED,
      data: {
        threadId,
        userId,
        toolCall: expect.objectContaining({
          id: 'tool-call-1',
          name: 'test_tool'
        }),
        messageId: mockToolCallsMessage.id
      }
    });
    expect(result).toEqual(mockToolCallsMessage.id);
  });

  test('should handle errors and publish error events', async () => {
    // 模拟错误
    const error = new Error('Test error');
    mockAIService.sendMessage = vi.fn().mockRejectedValue(error);

    // 执行并捕获错误
    await expect(messageSender.sendToLLM(threadId, userId)).rejects.toThrow(error);

    // 验证错误事件
    expect(mockEventBus.publish).toHaveBeenCalledWith({
      type: MessageEventType.ERROR_OCCURRED,
      data: {
        threadId,
        userId,
        error,
        context: 'sendToLLM'
      }
    });
  });
});
