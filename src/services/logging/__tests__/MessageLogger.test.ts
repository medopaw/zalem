import { describe, test, expect, beforeEach, vi } from 'vitest';
import { MessageLogger } from '../MessageLogger';
import { MessageType } from '../../../utils/MessageTypeManager';

// 直接模拟logger模块
vi.mock('../../../utils/logger', () => {
  return {
    default: {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn()
    }
  };
});

// 导入模拟的logger
import logger from '../../../utils/logger';

describe('MessageLogger', () => {
  // 在每个测试前重置模拟
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logDatabaseMessage', () => {
    test('应该记录数据库消息', () => {
      // 创建测试数据
      const message = {
        id: 'msg-1',
        content: 'Hello, world!',
        role: 'user',
        created_at: '2023-01-01T00:00:00Z',
        user_id: 'user-1',
        thread_id: 'thread-1',
        is_visible: true,
        send_to_llm: true
      };

      // 调用测试方法
      MessageLogger.logDatabaseMessage(message, 'test_context');

      // 验证日志记录
      expect(logger.info).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith(
        '[test_context] 数据库消息:',
        [expect.objectContaining({
          id: 'msg-1',
          role: 'user',
          thread_id: 'thread-1',
          user_id: 'user-1',
          is_visible: true,
          send_to_llm: true,
          content_summary: 'Hello, world!'
        })],
        'MessageLogger'
      );
    });
  });
});
