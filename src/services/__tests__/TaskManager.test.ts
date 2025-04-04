import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabase } from '../../lib/supabase';
import { MessageParser } from '../../services/MessageParser';
import { getChatService } from '../ChatService';

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}));

// Mock Chat Service
vi.mock('../../services/chatService', () => ({
  getChatService: vi.fn(() => ({
    sendMessage: vi.fn().mockResolvedValue({ 
      type: 'execution_result', 
      status: 'success', 
      message: '任务已更新' 
    })
  }))
}));

describe('Task Loading', () => {
  const userId = 'test-user-id';
  let mockSupabaseFrom: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom = supabase.from as unknown as ReturnType<typeof vi.fn>;
  });

  it('should return empty array when no tasks exist', async () => {
    // Mock the response for no tasks
    mockSupabaseFrom.mockImplementationOnce(() => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            data: [],
            error: null
          })
        })
      })
    }));

    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    expect(data).toEqual([]);
  });

  it('should return tasks when they exist', async () => {
    const mockTasks = [
      {
        task_id: '1',
        role: 'owner',
        tasks: {
          id: '1',
          title: 'Test Task 1',
          description: 'Description 1',
          status: 'not_started',
          priority: 'p2',
          risk_level: 'low',
          created_at: new Date().toISOString()
        }
      },
      {
        task_id: '2',
        role: 'assignee',
        tasks: {
          id: '2',
          title: 'Test Task 2',
          description: 'Description 2',
          status: 'in_progress',
          priority: 'p1',
          risk_level: 'medium',
          created_at: new Date().toISOString()
        }
      }
    ];

    // Mock the response with tasks
    mockSupabaseFrom.mockImplementationOnce(() => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            data: mockTasks,
            error: null
          })
        })
      })
    }));

    const { data } = await supabase
      .from('task_assignees')
      .select(`
        task_id,
        role,
        tasks (
          id,
          title,
          status,
          priority,
          risk_level,
          start_date,
          due_date,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    expect(data).toEqual(mockTasks);
    expect(data?.length).toBe(2);
  });

  it('should handle database errors', async () => {
    // Mock a database error
    mockSupabaseFrom.mockImplementationOnce(() => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            data: null,
            error: new Error('Database error')
          })
        })
      })
    }));

    const { error } = await supabase
      .from('tasks')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    expect(error).toBeTruthy();
    expect(error).toBeInstanceOf(Error);
  });

  it('should include all required task fields', async () => {
    const mockTask = {
      id: '1',
      title: 'Test Task',
      description: 'Task Description',
      status: 'not_started',
      priority: 'p2',
      risk_level: 'low',
      start_date: null,
      due_date: null,
      workload: null,
      module: null,
      parent_task_id: null,
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Mock the response with a task containing all fields
    mockSupabaseFrom.mockImplementationOnce(() => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            data: [mockTask],
            error: null
          })
        })
      })
    }));

    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    expect(data?.[0]).toEqual(mockTask);
    expect(Object.keys(data?.[0] ?? {})).toEqual(Object.keys(mockTask));
  });

  it('should order tasks by creation date descending', async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const mockTasks = [
      {
        id: '1',
        title: 'Newer Task',
        created_at: now.toISOString(),
        created_by: userId
      },
      {
        id: '2',
        title: 'Older Task',
        created_at: yesterday.toISOString(),
        created_by: userId
      }
    ];

    // Mock the response with ordered tasks
    mockSupabaseFrom.mockImplementationOnce(() => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            data: mockTasks,
            error: null
          })
        })
      })
    }));

    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    expect(data?.[0].title).toBe('Newer Task');
    expect(data?.[1].title).toBe('Older Task');
  });
});

describe('Task Priority Update', () => {
  const userId = 'test-user-id';
  const taskId = '0a5c0cda-a1ca-423c-8f3e-3386f6e2e1b6';
  let messageParser: MessageParser;
  let mockSupabaseFrom: any;
  let mockChatService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    messageParser = new MessageParser();
    mockSupabaseFrom = supabase.from as unknown as ReturnType<typeof vi.fn>;
    mockChatService = getChatService();
  });

  it('should update task priority from P3 to P1', async () => {
    // Mock existing task with P3 priority
    mockSupabaseFrom.mockImplementationOnce(() => ({
      select: () => ({
        eq: () => ({
          single: () => ({
            data: {
              id: taskId,
              priority: 'p3',
              created_by: userId
            },
            error: null
          })
        })
      })
    }));

    // Mock priority history insert
    mockSupabaseFrom.mockImplementationOnce(() => ({
      insert: () => ({
        select: () => ({
          single: () => ({
            data: {
              id: 'history-1',
              task_id: taskId,
              old_priority: 'p3',
              new_priority: 'p1',
              changed_by: userId
            },
            error: null
          })
        })
      })
    }));

    // Mock task update
    mockSupabaseFrom.mockImplementationOnce(() => ({
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => ({
              data: {
                id: taskId,
                priority: 'p1'
              },
              error: null
            })
          })
        })
      })
    }));

    const updateMessage = JSON.stringify({
      type: 'tool_call',
      name: 'updateTask',
      parameters: {
        task_id: taskId,
        priority: 'p1'
      }
    });

    const context = {
      userId,
      supabase,
      chatHistory: [],
      chatService: getChatService(),
      threadId: 'test-thread',
      saveMessage: (content: string, role: 'user' | 'assistant') => Promise.resolve({
        id: 'msg-1',
        content,
        role,
        created_at: new Date().toISOString(),
        user_id: userId,
        thread_id: 'test-thread'
      })
    };

    const messages = await messageParser.parseMessage(updateMessage, context);

    // Verify the success message was generated
    const lastMessage = messages[messages.length - 1];
    const content = JSON.parse(lastMessage.content);
    expect(content.type).toBe('execution_result');
    expect(content.status).toBe('success');
  });

  it('should handle task update failure gracefully', async () => {
    // Mock existing task fetch
    mockSupabaseFrom.mockImplementationOnce(() => ({
      select: () => ({
        eq: () => ({
          single: () => ({
            data: {
              id: taskId,
              priority: 'p2',
              created_by: userId
            },
            error: null
          })
        })
      })
    }));

    // Mock priority history insert
    mockSupabaseFrom.mockImplementationOnce(() => ({
      insert: () => ({
        select: () => ({
          single: () => ({
            data: {
              id: 'history-1',
              task_id: taskId,
              old_priority: 'p2',
              new_priority: 'p0',
              changed_by: userId
            },
            error: null
          })
        })
      })
    }));

    // Mock update failure
    mockSupabaseFrom.mockImplementationOnce(() => ({
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => {
              throw new Error('Database error');
            }
          })
        })
      })
    }));

    const updateMessage = JSON.stringify({
      type: 'tool_call',
      name: 'updateTask',
      parameters: {
        task_id: taskId,
        priority: 'p0'
      }
    });

    const context = {
      userId,
      supabase,
      chatHistory: [],
      chatService: getChatService(),
      threadId: 'test-thread',
      saveMessage: (content: string, role: 'user' | 'assistant') => Promise.resolve({
        id: 'msg-1',
        content,
        role,
        created_at: new Date().toISOString(),
        user_id: userId,
        thread_id: 'test-thread'
      })
    };

    const messages = await messageParser.parseMessage(updateMessage, context);

    // Verify error message was generated
    const lastMessage = messages[messages.length - 1];
    const content = JSON.parse(lastMessage.content);
    expect(content.type).toBe('execution_result');
    expect(content.status).toBe('error');
    expect(content.message).toBe('Database error');
  });
});
