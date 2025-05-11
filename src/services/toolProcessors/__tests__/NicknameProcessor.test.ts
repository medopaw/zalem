import { describe, test, expect, beforeEach, vi } from 'vitest';
import { NicknameProcessor } from '../NicknameProcessor';
import { IUserRepository } from '../../../repositories/IUserRepository';
import { IPregeneratedMessageRepository } from '../../../repositories/IPregeneratedMessageRepository';

// 创建模拟对象
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

describe('NicknameProcessor', () => {
  let nicknameProcessor: NicknameProcessor;

  beforeEach(() => {
    // 重置所有模拟
    vi.clearAllMocks();

    // 创建昵称处理器
    nicknameProcessor = new NicknameProcessor(
      mockUserRepository,
      mockPregeneratedMessageRepository
    );
  });

  test('canProcess should return true for supported tools', () => {
    expect(nicknameProcessor.canProcess('set_nickname')).toBe(true);
    expect(nicknameProcessor.canProcess('clear_nickname')).toBe(true);
    expect(nicknameProcessor.canProcess('unknown_tool')).toBe(false);
  });

  test('processToolCall should handle set_nickname', async () => {
    // 设置模拟返回值
    mockUserRepository.updateNickname.mockResolvedValue();
    mockPregeneratedMessageRepository.clearUnusedMessages.mockResolvedValue(true);

    // 调用方法
    const result = await nicknameProcessor.processToolCall(
      {
        id: 'tool-call-1',
        name: 'set_nickname',
        arguments: { nickname: 'Test User' }
      },
      'thread-1',
      'user-1'
    );

    // 验证结果
    expect(result.toolCallId).toBe('tool-call-1');
    expect(result.status).toBe('success');
    expect(result.result).toEqual({ nickname: 'Test User' });
    expect(result.message).toBe('昵称已设置为 Test User');

    // 验证调用
    expect(mockUserRepository.updateNickname).toHaveBeenCalledWith('user-1', 'Test User');
    expect(mockPregeneratedMessageRepository.clearUnusedMessages).toHaveBeenCalledWith('user-1');
  });

  test('processToolCall should handle clear_nickname', async () => {
    // 设置模拟返回值
    mockUserRepository.updateNickname.mockResolvedValue();
    mockPregeneratedMessageRepository.clearUnusedMessages.mockResolvedValue(true);

    // 调用方法
    const result = await nicknameProcessor.processToolCall(
      {
        id: 'tool-call-2',
        name: 'clear_nickname',
        arguments: {}
      },
      'thread-1',
      'user-1'
    );

    // 验证结果
    expect(result.toolCallId).toBe('tool-call-2');
    expect(result.status).toBe('success');
    expect(result.result).toEqual({ nickname: null });
    expect(result.message).toBe('昵称已清除');

    // 验证调用
    expect(mockUserRepository.updateNickname).toHaveBeenCalledWith('user-1', null);
    expect(mockPregeneratedMessageRepository.clearUnusedMessages).toHaveBeenCalledWith('user-1');
  });

  test('processToolCall should handle errors', async () => {
    // 设置模拟抛出错误
    mockUserRepository.updateNickname.mockRejectedValue(new Error('Database error'));

    // 调用方法
    const result = await nicknameProcessor.processToolCall(
      {
        id: 'tool-call-3',
        name: 'set_nickname',
        arguments: { nickname: 'Test User' }
      },
      'thread-1',
      'user-1'
    );

    // 验证结果
    expect(result.toolCallId).toBe('tool-call-3');
    expect(result.status).toBe('error');
    expect(result.result).toBeNull();
    expect(result.message).toBe('Database error');
  });

  test('processToolCall should validate nickname', async () => {
    // 调用方法，不提供昵称
    const result = await nicknameProcessor.processToolCall(
      {
        id: 'tool-call-4',
        name: 'set_nickname',
        arguments: { nickname: '' }
      },
      'thread-1',
      'user-1'
    );

    // 验证结果
    expect(result.toolCallId).toBe('tool-call-4');
    expect(result.status).toBe('error');
    expect(result.result).toBeNull();
    expect(result.message).toBe('昵称不能为空');

    // 验证没有调用更新昵称
    expect(mockUserRepository.updateNickname).not.toHaveBeenCalled();
  });
});
