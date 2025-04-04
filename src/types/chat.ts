/**
 * Represents a chat message role
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Represents a tool call in the LLM response
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Represents a complete message from the LLM
 */
export interface LLMMessage {
  role: MessageRole;
  content: string | null;
  tool_calls?: ToolCall[];
}

/**
 * Represents a chat message
 */
export interface ChatMessage {
  /** Unique identifier for the message */
  id: string;
  /** The content of the message */
  content: string;
  /** The role of the message sender */
  role: MessageRole;
  /** Timestamp when the message was created */
  created_at: string;
  /** ID of the user who sent/received the message */
  user_id: string;
}

/**
 * Represents a message in the chat history
 */
export interface ChatHistoryMessage {
  /** The role of the message sender */
  role: MessageRole;
  /** The content of the message */
  content: string;
}

/**
 * Response structure from the DeepSeek API
 */
export interface ChatResponse {
  choices: Array<{
    message: LLMMessage;
  }>;
}

/**
 * Configuration for the chat service
 */
export interface ChatServiceConfig {
  /** Base URL for the DeepSeek API */
  baseURL?: string;
  /** Model to use for chat completions */
  model?: string;
  /** Temperature for response generation */
  temperature?: number;
  /** Maximum tokens in the response */
  maxTokens?: number;
}

/**
 * Available data that can be requested by the AI
 */
export interface AvailableData {
  /** User's current nickname */
  nickname?: string;
  /** User's role (admin/user) */
  role?: string;
  /** User's creation date */
  created_at?: string;
}

/**
 * Data request from the AI
 */
export interface DataRequest {
  type: 'data_request';
  fields: (keyof AvailableData)[];
}

/**
 * Data response to the AI
 */
export interface DataResponse {
  type: 'data_response';
  data: Partial<AvailableData>;
}

export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
    }>;
    required?: string[];
  };
}

export interface FunctionCall {
  name: string;
  arguments: string;
}