import { describe, test, expect } from 'vitest';
import {
  DatabaseMessage,
  DisplayMessage,
  LLMHistoryMessage,
  toDisplayMessage,
  toLLMHistoryMessage,
  createDatabaseMessage,
  ToolCallContent,
  ToolResultContent,
  DataResponseContent
} from './messageStructures';

describe('Message Structure Conversions', () => {
  // 测试数据
  const userId = 'user-123';
  const threadId = 'thread-456';
  const toolCallId = 'call-789';

  describe('createDatabaseMessage', () => {
    test('should create a text message correctly', () => {
      const result = createDatabaseMessage({
        content: '你好，世界！',
        role: 'user',
        userId,
        threadId
      });

      expect(result).toEqual({
        content: '你好，世界！',
        role: 'user',
        user_id: userId,
        thread_id: threadId,
        is_visible: true,
        send_to_llm: true,
        tool_call_id: undefined,
        sequence: undefined,
        metadata: undefined
      });
    });

    test('should create a tool call message correctly', () => {
      const toolCall = {
        type: 'tool_call',
        name: 'create_task',
        parameters: { title: '写 AI 任务管理系统' }
      };

      const result = createDatabaseMessage({
        content: toolCall,
        role: 'assistant',
        userId,
        threadId
      });

      expect(result).toEqual({
        content: JSON.stringify(toolCall),
        role: 'assistant',
        user_id: userId,
        thread_id: threadId,
        is_visible: true,
        send_to_llm: true,
        tool_call_id: undefined,
        sequence: undefined,
        metadata: undefined
      });
    });

    test('should create a tool result message correctly', () => {
      const toolResult = {
        type: 'tool_result',
        tool_call_id: toolCallId,
        status: 'success',
        message: '任务创建成功'
      };

      const result = createDatabaseMessage({
        content: toolResult,
        role: 'tool',
        userId,
        threadId,
        toolCallId
      });

      expect(result).toEqual({
        content: JSON.stringify(toolResult),
        role: 'tool',
        user_id: userId,
        thread_id: threadId,
        is_visible: true,
        send_to_llm: true,
        tool_call_id: toolCallId,
        sequence: undefined,
        metadata: undefined
      });
    });

    test('should create a data response message correctly', () => {
      const dataResponse: DataResponseContent = {
        type: 'data_response',
        data: {
          nickname: '齐天大圣',
          tasks: [{ id: 'task-1', title: '写 AI 任务管理系统' }]
        }
      };

      const result = createDatabaseMessage({
        content: dataResponse,
        role: 'assistant',
        userId,
        threadId,
        isVisible: true,
        sendToLLM: false // 数据响应不需要发送给 LLM
      });

      expect(result).toEqual({
        content: JSON.stringify(dataResponse),
        role: 'assistant',
        user_id: userId,
        thread_id: threadId,
        is_visible: true,
        send_to_llm: false,
        tool_call_id: undefined,
        sequence: undefined,
        metadata: undefined
      });
    });
  });

  describe('toDisplayMessage', () => {
    test('should convert text message correctly', () => {
      const dbMessage: DatabaseMessage = {
        id: 'msg-1',
        content: '你好，世界！',
        role: 'user',
        created_at: '2023-01-01T00:00:00Z',
        user_id: userId,
        thread_id: threadId,
        is_visible: true,
        send_to_llm: true
      };

      const result = toDisplayMessage(dbMessage);

      expect(result).toEqual({
        id: 'msg-1',
        content: '你好，世界！',
        role: 'user',
        created_at: '2023-01-01T00:00:00Z',
        user_id: userId,
        metadata: undefined
      });
    });

    test('should convert tool call message correctly', () => {
      const toolCall = {
        type: 'tool_call',
        name: 'create_task',
        parameters: { title: '写 AI 任务管理系统' }
      };

      const dbMessage: DatabaseMessage = {
        id: 'msg-2',
        content: JSON.stringify(toolCall),
        role: 'assistant',
        created_at: '2023-01-01T00:00:00Z',
        user_id: userId,
        thread_id: threadId,
        is_visible: true,
        send_to_llm: true
      };

      const result = toDisplayMessage(dbMessage);

      expect(result).toEqual({
        id: 'msg-2',
        content: toolCall,
        role: 'assistant',
        created_at: '2023-01-01T00:00:00Z',
        user_id: userId,
        metadata: undefined
      });
    });

    test('should convert tool result message correctly', () => {
      const toolResult: ToolResultContent = {
        type: 'tool_result',
        tool_call_id: toolCallId,
        status: 'success',
        message: '任务创建成功'
      };

      const dbMessage: DatabaseMessage = {
        id: 'msg-3',
        content: JSON.stringify(toolResult),
        role: 'tool',
        created_at: '2023-01-01T00:00:00Z',
        user_id: userId,
        thread_id: threadId,
        is_visible: true,
        send_to_llm: true,
        tool_call_id: toolCallId
      };

      const result = toDisplayMessage(dbMessage);

      expect(result).toEqual({
        id: 'msg-3',
        content: toolResult,
        role: 'tool',
        created_at: '2023-01-01T00:00:00Z',
        user_id: userId,
        metadata: undefined
      });
    });

    test('should handle invalid JSON gracefully', () => {
      const dbMessage: DatabaseMessage = {
        id: 'msg-4',
        content: 'This is not JSON',
        role: 'assistant',
        created_at: '2023-01-01T00:00:00Z',
        user_id: userId,
        thread_id: threadId,
        is_visible: true,
        send_to_llm: true
      };

      const result = toDisplayMessage(dbMessage);

      expect(result).toEqual({
        id: 'msg-4',
        content: 'This is not JSON',
        role: 'assistant',
        created_at: '2023-01-01T00:00:00Z',
        user_id: userId,
        metadata: undefined
      });
    });
  });

  describe('toLLMHistoryMessage', () => {
    test('should convert user message correctly', () => {
      const dbMessage: DatabaseMessage = {
        id: 'msg-1',
        content: '你好，世界！',
        role: 'user',
        created_at: '2023-01-01T00:00:00Z',
        user_id: userId,
        thread_id: threadId,
        is_visible: true,
        send_to_llm: true
      };

      const result = toLLMHistoryMessage(dbMessage);

      expect(result).toEqual({
        role: 'user',
        content: '你好，世界！'
      });
    });

    test('should convert assistant text message correctly', () => {
      const dbMessage: DatabaseMessage = {
        id: 'msg-2',
        content: '你好！有什么可以帮助你的？',
        role: 'assistant',
        created_at: '2023-01-01T00:00:00Z',
        user_id: userId,
        thread_id: threadId,
        is_visible: true,
        send_to_llm: true
      };

      const result = toLLMHistoryMessage(dbMessage);

      expect(result).toEqual({
        role: 'assistant',
        content: '你好！有什么可以帮助你的？'
      });
    });

    test('should convert assistant tool call message correctly', () => {
      // 注意：这里使用 type: 'tool_calls' 而不是 'tool_call'
      const toolCalls = {
        type: 'tool_calls',
        calls: [{
          id: toolCallId,
          name: 'create_task',
          parameters: { title: '写 AI 任务管理系统' }
        }]
      };

      const dbMessage: DatabaseMessage = {
        id: 'msg-3',
        content: JSON.stringify(toolCalls),
        role: 'assistant',
        created_at: '2023-01-01T00:00:00Z',
        user_id: userId,
        thread_id: threadId,
        is_visible: true,
        send_to_llm: true
      };

      const result = toLLMHistoryMessage(dbMessage);

      expect(result).toEqual({
        role: 'assistant',
        content: null,
        tool_calls: [{
          id: toolCallId,
          type: 'function',
          function: {
            name: 'create_task',
            arguments: JSON.stringify({ title: '写 AI 任务管理系统' })
          }
        }]
      });
    });

    test('should convert tool message correctly', () => {
      const dbMessage: DatabaseMessage = {
        id: 'msg-4',
        content: '{"success":true}',
        role: 'tool',
        created_at: '2023-01-01T00:00:00Z',
        user_id: userId,
        thread_id: threadId,
        is_visible: true,
        send_to_llm: true,
        tool_call_id: toolCallId
      };

      const result = toLLMHistoryMessage(dbMessage);

      expect(result).toEqual({
        role: 'tool',
        content: '{"success":true}',
        tool_call_id: toolCallId
      });
    });

    test('should handle invalid JSON gracefully', () => {
      const dbMessage: DatabaseMessage = {
        id: 'msg-5',
        content: 'This is not JSON',
        role: 'assistant',
        created_at: '2023-01-01T00:00:00Z',
        user_id: userId,
        thread_id: threadId,
        is_visible: true,
        send_to_llm: true
      };

      const result = toLLMHistoryMessage(dbMessage);

      expect(result).toEqual({
        role: 'assistant',
        content: 'This is not JSON'
      });
    });
  });

  // 测试 JSON 示例中的消息转换
  describe('JSON Example Messages', () => {
    test('should convert system message correctly', () => {
      const systemMessage = {
        role: 'system',
        content: '你是一个友好的中文助手。请用中文回复用户。'
      };

      // 创建数据库消息
      const dbMessage = createDatabaseMessage({
        content: systemMessage.content,
        role: 'system',
        userId,
        threadId,
        isVisible: false,
        sendToLLM: true
      });

      // 转换为 LLM 历史消息
      const llmMessage = toLLMHistoryMessage({
        ...dbMessage,
        id: 'sys-1',
        created_at: '2023-01-01T00:00:00Z'
      });

      expect(llmMessage).toEqual({
        role: 'system',
        content: '你是一个友好的中文助手。请用中文回复用户。'
      });
    });

    test('should convert user message correctly', () => {
      const userMessage = {
        role: 'user',
        content: '你好，我刚开始一个新的对话。请用友好的方式问候我，询问我最近在忙什么或者我的状态，但不要让你的回复看起来像是在回答我的问题。'
      };

      // 创建数据库消息
      const dbMessage = createDatabaseMessage({
        content: userMessage.content,
        role: 'user',
        userId,
        threadId
      });

      // 转换为显示消息
      const displayMessage = toDisplayMessage({
        ...dbMessage,
        id: 'user-1',
        created_at: '2023-01-01T00:00:00Z'
      });

      expect(displayMessage.content).toEqual(userMessage.content);
      expect(displayMessage.role).toEqual('user');
    });

    test('should convert assistant text message correctly', () => {
      const assistantMessage = {
        role: 'assistant',
        content: '嘿 X 哥！最近在忙啥呢？'
      };

      // 创建数据库消息
      const dbMessage = createDatabaseMessage({
        content: assistantMessage.content,
        role: 'assistant',
        userId,
        threadId
      });

      // 转换为显示消息
      const displayMessage = toDisplayMessage({
        ...dbMessage,
        id: 'asst-1',
        created_at: '2023-01-01T00:00:00Z'
      });

      expect(displayMessage.content).toEqual(assistantMessage.content);
      expect(displayMessage.role).toEqual('assistant');
    });

    test('should convert assistant tool calls message correctly', () => {

      // 为第一个工具调用创建数据库消息
      const toolCall1: ToolCallContent = {
        type: 'tool_call',
        name: 'create_task',
        parameters: { title: '写 AI 任务管理系统' }
      };

      const dbMessage1 = createDatabaseMessage({
        content: toolCall1,
        role: 'assistant',
        userId,
        threadId
      });

      // 转换为显示消息
      const displayMessage1 = toDisplayMessage({
        ...dbMessage1,
        id: 'tool-call-1',
        created_at: '2023-01-01T00:00:00Z'
      });

      expect(displayMessage1.content).toEqual(toolCall1);
      expect(displayMessage1.role).toEqual('assistant');

      // 为第二个工具调用创建数据库消息
      const toolCall2: ToolCallContent = {
        type: 'tool_call',
        name: 'set_nickname',
        parameters: { nickname: '齐天大圣' }
      };

      const dbMessage2 = createDatabaseMessage({
        content: toolCall2,
        role: 'assistant',
        userId,
        threadId
      });

      // 转换为显示消息
      const displayMessage2 = toDisplayMessage({
        ...dbMessage2,
        id: 'tool-call-2',
        created_at: '2023-01-01T00:00:00Z'
      });

      expect(displayMessage2.content).toEqual(toolCall2);
      expect(displayMessage2.role).toEqual('assistant');
    });

    test('should convert tool response message correctly', () => {
      const toolResponseMessage = {
        role: 'tool',
        tool_call_id: 'call_0_9dk2dl8a-202d-dkw3-223d-dk0dk29dm398',
        content: '{"success":true}'
      };

      // 创建工具结果消息
      const toolResult = {
        type: 'tool_result',
        tool_call_id: 'call_0_9dk2dl8a-202d-dkw3-223d-dk0dk29dm398',
        status: 'success',
        message: '任务创建成功'
      };

      const dbMessage = createDatabaseMessage({
        content: toolResult,
        role: 'tool',
        userId,
        threadId,
        toolCallId: 'call_0_9dk2dl8a-202d-dkw3-223d-dk0dk29dm398'
      });

      // 转换为显示消息
      const displayMessage = toDisplayMessage({
        ...dbMessage,
        id: 'tool-result-1',
        created_at: '2023-01-01T00:00:00Z'
      });

      expect(displayMessage.content).toEqual(toolResult);
      expect(displayMessage.role).toEqual('tool');

      // 转换为 LLM 历史消息
      const llmMessage = toLLMHistoryMessage({
        ...dbMessage,
        id: 'tool-result-1',
        created_at: '2023-01-01T00:00:00Z',
        content: toolResponseMessage.content
      });

      expect(llmMessage).toEqual({
        role: 'tool',
        content: '{"success":true}',
        tool_call_id: 'call_0_9dk2dl8a-202d-dkw3-223d-dk0dk29dm398'
      });
    });
  });
});
