import { describe, test, expect, beforeEach, vi } from 'vitest';
import { MessageService } from '../MessageService';
import { getMessageEventBus } from '../MessageEventBus';
import { MessageEventType } from '../../../types/messaging';
import { IMessageRepository } from '../../../repositories/IMessageRepository';
import { IThreadRepository } from '../../../repositories/IThreadRepository';
import { IToolCallProcessorRegistry } from '../ToolCallProcessorRegistry';
import { AIService } from '../../ai/AIService';
import { NicknameProcessor } from '../../toolProcessors/NicknameProcessor';
import { IUserRepository } from '../../../repositories/IUserRepository';
import { IPregeneratedMessageRepository } from '../../../repositories/IPregeneratedMessageRepository';

// 创建模拟对象
const mockMessageRepository = {
  getMessages: vi.fn(),
  saveMessage: vi.fn(),
  getLLMHistoryMessages: vi.fn(),
  clearMessages: vi.fn(),
  createWelcomeMessage: vi.fn()
};

const mockThreadRepository = {
  getThread: vi.fn(),
  getThreads: vi.fn(),
  updateThreadTitle: vi.fn(),
  checkConnection: vi.fn()
};

const mockUserRepository = {
  getUserInfo: vi.fn(),
  updateNickname: vi.fn(),
  updateRole: vi.fn()
};

const mockPregeneratedMessageRepository = {
  clearUnusedMessages: vi.fn(),
  getNextPregenerated: vi.fn(),
  markAsUsed: vi.fn(),
  createPregenerated: vi.fn()
};

const mockAIService = {
  sendMessage: vi.fn(),
  generateTitle: vi.fn()
};

describe('Tool Call Flow', () => {
  let messageService: MessageService;
  let nicknameProcessor: NicknameProcessor;
  let eventBus: ReturnType<typeof getMessageEventBus>;
  let mockToolProcessorRegistry: IToolCallProcessorRegistry;

  beforeEach(() => {
    // 重置所有模拟
    vi.clearAllMocks();

    // 获取事件总线
    eventBus = getMessageEventBus();

    // 创建昵称处理器
    nicknameProcessor = new NicknameProcessor(
      mockUserRepository,
      mockPregeneratedMessageRepository
    );

    // 创建工具处理器注册表
    mockToolProcessorRegistry = {
      registerProcessor: vi.fn(),
      getProcessor: vi.fn().mockImplementation((toolName) => {
        if (toolName === 'set_nickname' || toolName === 'clear_nickname') {
          return nicknameProcessor;
        }
        return undefined;
      }),
      getAllProcessors: vi.fn().mockReturnValue([nicknameProcessor])
    };

    // 创建消息服务
    messageService = new MessageService(
      mockMessageRepository,
      mockThreadRepository,
      mockToolProcessorRegistry,
      mockAIService
    );
  });

  test('end-to-end tool call flow', async () => {
    // 设置模拟返回值
    // 1. 用户发送消息
    mockMessageRepository.saveMessage.mockImplementation((content, role, userId, threadId, options) => {
      return Promise.resolve({
        id: `message-${Date.now()}`,
        content,
        role,
        created_at: new Date().toISOString(),
        user_id: userId,
        thread_id: threadId,
        is_visible: options?.isVisible !== false,
        send_to_llm: options?.sendToLLM !== false,
        tool_call_id: options?.toolCallId
      });
    });

    mockMessageRepository.getLLMHistoryMessages.mockResolvedValue({
      messages: [],
      error: null
    });

    // 2. 大模型返回带有工具调用的响应
    mockAIService.sendMessage.mockImplementation(async (messages) => {
      // 检查是否是工具调用结果消息
      const toolResultMessage = messages.find(msg => msg.role === 'tool');

      if (toolResultMessage) {
        // 如果是工具调用结果，返回一个普通响应
        return {
          role: 'assistant',
          content: '我已经将你的昵称设置为 Test User 了！'
        };
      } else {
        // 如果是用户消息，返回一个工具调用
        return {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'tool-call-1',
              function: {
                name: 'set_nickname',
                arguments: JSON.stringify({ nickname: 'Test User' })
              }
            }
          ]
        };
      }
    });

    mockMessageRepository.getMessages.mockResolvedValue({
      messages: [],
      error: null
    });

    mockUserRepository.updateNickname.mockResolvedValue();
    mockPregeneratedMessageRepository.clearUnusedMessages.mockResolvedValue(true);

    // 创建事件监听器
    const userMessageListener = vi.fn();
    const assistantMessageListener = vi.fn();
    const toolCallListener = vi.fn();
    const toolResultListener = vi.fn();

    eventBus.subscribe(MessageEventType.USER_MESSAGE_SENT, userMessageListener);
    eventBus.subscribe(MessageEventType.ASSISTANT_MESSAGE_RECEIVED, assistantMessageListener);
    eventBus.subscribe(MessageEventType.TOOL_CALL_RECEIVED, toolCallListener);
    eventBus.subscribe(MessageEventType.TOOL_RESULT_SENT, toolResultListener);

    // 执行端到端流程
    await messageService.sendUserMessage('请把我的昵称设置为 Test User', 'thread-1', 'user-1');

    // 验证事件顺序
    // 1. 用户消息事件
    expect(userMessageListener).toHaveBeenCalledTimes(1);

    // 2. 工具调用事件
    expect(toolCallListener).toHaveBeenCalledTimes(1);
    const toolCallEvent = toolCallListener.mock.calls[0][0];
    expect(toolCallEvent.type).toBe(MessageEventType.TOOL_CALL_RECEIVED);
    expect(toolCallEvent.data.toolCall.name).toBe('set_nickname');

    // 3. 工具调用结果事件
    expect(toolResultListener).toHaveBeenCalledTimes(1);
    const toolResultEvent = toolResultListener.mock.calls[0][0];
    expect(toolResultEvent.type).toBe(MessageEventType.TOOL_RESULT_SENT);
    expect(toolResultEvent.data.toolResult.status).toBe('success');

    // 4. 大模型响应事件
    expect(assistantMessageListener).toHaveBeenCalledTimes(1);
    const assistantEvent = assistantMessageListener.mock.calls[0][0];
    expect(assistantEvent.type).toBe(MessageEventType.ASSISTANT_MESSAGE_RECEIVED);
    expect(assistantEvent.data.content).toBe('我已经将你的昵称设置为 Test User 了！');

    // 验证调用
    // 1. 保存用户消息
    expect(mockMessageRepository.saveMessage).toHaveBeenCalledWith(
      '请把我的昵称设置为 Test User',
      'user',
      'user-1',
      'thread-1',
      expect.any(Object)
    );

    // 2. 发送消息给大模型
    expect(mockAIService.sendMessage).toHaveBeenCalledTimes(2);

    // 3. 更新用户昵称
    expect(mockUserRepository.updateNickname).toHaveBeenCalledWith('user-1', 'Test User');

    // 4. 清除预生成消息
    expect(mockPregeneratedMessageRepository.clearUnusedMessages).toHaveBeenCalledWith('user-1');
  });
});
