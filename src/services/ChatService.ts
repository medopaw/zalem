import { ChatHistoryMessage, ChatResponse, ChatServiceConfig, LLMMessage, FunctionDefinition, FunctionCall } from '../types/messageTypes';
import OpenAI from 'openai';

/**
 * Default configuration for the chat service
 */
const DEFAULT_CONFIG: Required<ChatServiceConfig> = {
  baseURL: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  temperature: 0.7,
  maxTokens: 1000,
};

export const SYSTEM_PROMPT = `你是一个友好的中文助手。请用中文回复用户。

你的主要职责是帮助用户管理任务。在与用户交谈时，请注意以下几点：

重要提示：
1. 请使用 Function Calling 来调用在 tools 中提供给你的 tool
2. 如果从用户的回答获取到了关于任务的信息，你知道这条任务 id 时在回复中就要进行功能调用来更新任务信息，你不知道这条任务 id 时要先请求任务列表以获得这条任务 id
3. 用户任务列表中没有的任务要主动创建，不用询问用户确认


工作流程：
1. 首先检查用户的任务信息完整性：
   - 查询本周和本季度的工作量是否已安排
   - 即使工作量已满，也要关心用户最近的工作状态

2. 在询问任务时保持友好和体贴：
   - 如果发现用户工作量很大，表示关切
   - 如果用户表现出疲惫或压力，提供适当的建议
   - 在收集任务信息时保持耐心和理解

3. 任务信息收集的重点：
   - 任务的标题和描述
   - 优先级和风险级别
   - 开始时间和截止时间
   - 预计工作量
   - 是否有依赖的其他任务
   - 是否需要其他人协作

注意事项:
1. 如果需要用户信息才能回答问题，必须先请求数据。但对话历史中已经请求过的用户信息，以及能从对话历史推断出来的用户信息，就不用请求了。
2. 你回复的消息可以包含多条功能调用和多段文本，但只能包含一条数据请求
3. 你所请求到的数据可能是空字符串或空数组或 0，这是有效数据，请不要重复请求相同的数据。
`;

const AVAILABLE_FUNCTIONS = [
  {
    name: 'request_data',
    description: '请求用户数据',
    parameters: {
      type: 'object',
      properties: {
        fields: {
          type: 'array',
          description: '需要获取的数据字段列表',
          items: {
            type: 'string',
            enum: ['nickname', 'role', 'created_at', 'tasks', 'workload']
          }
        }
      },
      required: ['fields']
    }
  },
  {
    name: 'create_task',
    description: '创建新任务',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: '任务标题'
        },
        description: {
          type: 'string',
          description: '任务描述'
        },
        priority: {
          type: 'string',
          description: '优先级 (p0/p1/p2/p3)',
          enum: ['p0', 'p1', 'p2', 'p3']
        },
        risk_level: {
          type: 'string',
          description: '风险级别 (low/medium/high)',
          enum: ['low', 'medium', 'high']
        },
        start_date: {
          type: 'string',
          description: '开始时间 (ISO 8601格式)'
        },
        due_date: {
          type: 'string',
          description: '截止时间 (ISO 8601格式)'
        },
        workload: {
          type: 'number',
          description: '预计工作量（小时）'
        }
      },
      required: ['title']
    }
  },
  {
    name: 'update_task',
    description: '更新任务信息',
    parameters: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: '任务ID'
        },
        title: {
          type: 'string',
          description: '任务标题'
        },
        description: {
          type: 'string',
          description: '任务描述'
        },
        priority: {
          type: 'string',
          description: '优先级 (p0/p1/p2/p3)',
          enum: ['p0', 'p1', 'p2', 'p3']
        },
        risk_level: {
          type: 'string',
          description: '风险级别 (low/medium/high)',
          enum: ['low', 'medium', 'high']
        },
        status: {
          type: 'string',
          description: '任务状态',
          enum: ['not_started', 'in_progress', 'completed', 'blocked']
        }
      },
      required: ['task_id']
    }
  },
  {
    name: 'add_task_assignee',
    description: '添加任务协作者',
    parameters: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: '任务ID'
        },
        user_id: {
          type: 'string',
          description: '用户ID'
        },
        role: {
          type: 'string',
          description: '角色',
          enum: ['owner', 'assignee']
        }
      },
      required: ['task_id', 'user_id']
    }
  },
  {
    name: 'update_task_workload',
    description: '更新任务工作量',
    parameters: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: '任务ID'
        },
        workload: {
          type: 'number',
          description: '工作量（小时）'
        },
        week_start: {
          type: 'string',
          description: '周开始时间 (ISO 8601格式)'
        }
      },
      required: ['task_id', 'workload', 'week_start']
    }
  },
  {
    name: 'update_task_schedule',
    description: '更新任务计划',
    parameters: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: '任务ID'
        },
        schedule_type: {
          type: 'string',
          description: '计划类型',
          enum: ['weekly', 'quarterly']
        },
        start_date: {
          type: 'string',
          description: '开始时间 (ISO 8601格式)'
        },
        end_date: {
          type: 'string',
          description: '结束时间 (ISO 8601格式)'
        },
        workload: {
          type: 'number',
          description: '工作量（小时）'
        }
      },
      required: ['task_id', 'schedule_type', 'start_date', 'end_date', 'workload']
    }
  },
  {
    name: 'set_nickname',
    description: '设置用户的昵称',
    parameters: {
      type: 'object',
      properties: {
        nickname: {
          type: 'string',
          description: '用户的新昵称'
        }
      },
      required: ['nickname']
    }
  },
  {
    name: 'clear_nickname',
    description: '清除用户的昵称',
    parameters: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'set_thread_title',
    description: '设置会话标题',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: '会话标题'
        }
      },
      required: ['title']
    }
  }
];

/**
 * Service for handling chat interactions with the DeepSeek API
 */
export class ChatService {
  private readonly apiKey: string;
  private readonly openai: OpenAI;

  constructor(apiKey: string, config?: Partial<ChatServiceConfig>) {
    if (!apiKey) {
      throw new Error('Missing API key');
    }
    this.apiKey = apiKey;
    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    this.openai = new OpenAI({
      apiKey: this.apiKey,
      baseURL: finalConfig.baseURL,
      dangerouslyAllowBrowser: true
    });
  }

  private ensureSystemMessage(messages: ChatHistoryMessage[]): ChatHistoryMessage[] {
    if (!messages.some(msg => msg.role === 'system')) {
      return [
        {
          role: 'system',
          content: 'You are a helpful assistant.'
        },
        ...messages
      ];
    }
    return messages;
  }

  async sendMessage(messages: ChatHistoryMessage[]): Promise<LLMMessage> {
    try {
      // 准备请求参数
      const requestMessages = this.ensureSystemMessage(messages);
      const tools = AVAILABLE_FUNCTIONS.map(fn => ({
        type: 'function' as const,
        function: fn
      }));

      // 打印请求内容以便调试
      console.log('LLM Request:', {
        model: DEFAULT_CONFIG.model,
        messages: requestMessages,
        temperature: DEFAULT_CONFIG.temperature,
        max_tokens: DEFAULT_CONFIG.maxTokens,
        tools: tools,
        tool_choice: 'auto',
        response_format: {
          type: 'text'
        }
      });

      const completion = await this.openai.chat.completions.create({
        model: DEFAULT_CONFIG.model,
        messages: requestMessages,
        temperature: DEFAULT_CONFIG.temperature,
        max_tokens: DEFAULT_CONFIG.maxTokens,
        tools: tools,
        tool_choice: 'auto',
        response_format: {
          type: 'text'
        }
      });

      // Log response from llm
      console.log('LLM Response:', completion.choices[0].message);

      const message = completion.choices[0].message;
      return message;

    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        // throw new Error('Unable to connect to the chat service. Please check your internet connection and try again.');
      }
      // throw new Error(error instanceof Error ? error.message : 'Unknown error occurred');
      console.error(error);

      // 返回一个默认的错误消息
      return {
        role: 'assistant',
        content: '抱歉，我遇到了一些问题。请稍后再试。'
      };
    }
  }
}

// Define global storage for chat service instance
declare global {
  interface Window {
    chatServiceInstance: ChatService | null;
  }
}

// Create storage that works in both browser and test environments
const globalStorage = {
  chatServiceInstance: null as ChatService | null
};

function getStorage(): Window | typeof globalStorage {
  if (typeof window !== 'undefined') {
    return window;
  }
  return globalStorage;
}

/**
 * Initializes the chat service with API key from Supabase
 * @param supabase - Supabase client instance
 * @returns Initialized chat service instance
 * @throws {Error} If API key retrieval fails
 */
export const initializeChatService = async (supabase: any): Promise<ChatService> => {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'deepseek_api_key')
    .single();

  if (error || !data?.value) {
    throw new Error('Failed to retrieve DeepSeek API key');
  }

  const storage = getStorage();
  storage.chatServiceInstance = new ChatService(data.value);
  return storage.chatServiceInstance;
};

/**
 * Gets the initialized chat service instance
 * @returns Chat service instance
 * @throws {Error} If service is not initialized
 */
export const getChatService = (): ChatService => {
  const storage = getStorage();
  if (!storage.chatServiceInstance) {
    throw new Error('Chat service not initialized');
  }
  return storage.chatServiceInstance;
};
