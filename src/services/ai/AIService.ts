import { ChatHistoryMessage, ChatResponse, ChatServiceConfig, LLMMessage, FunctionDefinition, FunctionCall } from '../../types/messageTypes';
import OpenAI from 'openai';
import { SYSTEM_PROMPT, TITLE_GENERATION_SYSTEM_PROMPT } from '../../constants/prompts';

/**
 * Default configuration for the AI service
 */
const DEFAULT_CONFIG: Required<ChatServiceConfig> = {
  baseURL: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  temperature: 0.7,
  maxTokens: 1000,
};

/**
 * Available functions that can be called by the AI
 */
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
  // set_thread_title 已移除，改为使用 sendSingleMessage 方法生成标题
];

/**
 * Service for handling interactions with the AI API
 */
export class AIService {
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

  /**
   * 发送单条消息到AI并获取回应，不包含消息历史
   * @param systemPrompt - 系统提示
   * @param userMessage - 用户消息
   * @param enableTools - 是否启用工具调用，默认为false
   * @returns AI响应消息
   */
  async sendSingleMessage(
    systemPrompt: string,
    userMessage: string,
    enableTools: boolean = false
  ): Promise<LLMMessage> {
    try {
      // 准备消息
      const messages: ChatHistoryMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ];

      // 准备工具（如果启用）
      const tools = enableTools ? AVAILABLE_FUNCTIONS.map(fn => ({
        type: 'function' as const,
        function: fn
      })) : undefined;

      // 打印请求内容以便调试
      console.log('LLM Single Message Request:', {
        model: DEFAULT_CONFIG.model,
        messages,
        temperature: DEFAULT_CONFIG.temperature,
        max_tokens: DEFAULT_CONFIG.maxTokens,
        tools,
        tool_choice: enableTools ? 'auto' : undefined,
        response_format: { type: 'text' }
      });

      // 发送请求
      const completion = await this.openai.chat.completions.create({
        model: DEFAULT_CONFIG.model,
        messages,
        temperature: DEFAULT_CONFIG.temperature,
        max_tokens: DEFAULT_CONFIG.maxTokens,
        tools,
        tool_choice: enableTools ? 'auto' : undefined,
        response_format: { type: 'text' }
      });

      // 记录响应
      console.log('LLM Single Message Response:', completion.choices[0].message);

      return completion.choices[0].message;
    } catch (error) {
      console.error('Error in sendSingleMessage:', error);
      return {
        role: 'assistant',
        content: '抱歉，我遇到了一些问题。请稍后再试。'
      };
    }
  }

  /**
   * 生成对话标题
   * @param conversationHistory - 对话历史
   * @returns 生成的标题
   */
  async generateTitle(conversationHistory: string): Promise<string> {
    try {
      const response = await this.sendSingleMessage(
        TITLE_GENERATION_SYSTEM_PROMPT,
        conversationHistory
      );

      // 返回生成的标题（去除可能的引号和空格）
      return (response.content || '新对话').trim().replace(/^"|"$/g, '');
    } catch (error) {
      console.error('Error generating title:', error);
      return '新对话';
    }
  }

  /**
   * Send a message to the AI and get a response
   * @param messages - Chat history messages
   * @returns AI response message
   */
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

// Define global storage for AI service instance
declare global {
  interface Window {
    aiServiceInstance: AIService | null;
  }
}

// Create storage that works in both browser and test environments
const globalStorage = {
  aiServiceInstance: null as AIService | null
};

function getStorage(): Window | typeof globalStorage {
  if (typeof window !== 'undefined') {
    return window;
  }
  return globalStorage;
}

/**
 * Initializes the AI service with API key from Supabase
 * @param supabase - Supabase client instance
 * @returns Initialized AI service instance
 * @throws {Error} If API key retrieval fails
 */
export const initializeAIService = async (supabase: any): Promise<AIService> => {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'deepseek_api_key')
    .single();

  if (error || !data?.value) {
    throw new Error('Failed to retrieve DeepSeek API key');
  }

  const storage = getStorage();
  storage.aiServiceInstance = new AIService(data.value);
  return storage.aiServiceInstance;
};

/**
 * Gets the initialized AI service instance
 * @returns AI service instance
 * @throws {Error} If service is not initialized
 */
export const getAIService = (): AIService => {
  const storage = getStorage();
  if (!storage.aiServiceInstance) {
    throw new Error('AI service not initialized');
  }
  return storage.aiServiceInstance;
};
