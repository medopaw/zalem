import { BaseHandler } from './BaseHandler';
import type { MessageContext, ChatMessage, LLMMessage } from '../../types/messages';

/**
 * Handles data request messages
 */
export class DataRequestHandler extends BaseHandler {
  canHandle(message: LLMMessage): boolean {
    return message.tool_calls?.some(call =>
      call.function.name === 'request_data'
    ) || false;
  }

  async handle(message: LLMMessage, context: MessageContext): Promise<ChatMessage[]> {
    const messages: ChatMessage[] = [];

    // Save the original message if present
    if (message.content) {
      messages.push(await this.saveMessage(message.content, 'assistant', context));
    }

    // 保存工具调用消息
    if (message.tool_calls && message.tool_calls.length > 0) {
      // 创建工具调用消息
      const toolCallsContent = {
        type: 'tool_calls',
        calls: message.tool_calls.map(call => ({
          id: call.id,
          name: call.function.name,
          parameters: JSON.parse(call.function.arguments)
        }))
      };

      // 保存工具调用消息
      messages.push(await this.saveMessage(
        JSON.stringify(toolCallsContent),
        'tool', // 使用tool角色保持一致性
        context
      ));
    }

    // Find the request_data tool call
    const requestCall = message.tool_calls?.find(call =>
      call.function.name === 'request_data'
    );

    if (!requestCall) {
      throw new Error('No request_data tool call found');
    }

    try {
      const params = JSON.parse(requestCall.function.arguments);
      const responseData: Record<string, unknown> = {};

      // Fetch user data if needed
      if (params.fields.some(field => ['nickname', 'role', 'created_at'].includes(field))) {
        const { data: userData, error: userError } = await context.supabase
          .from('users')
          .select('nickname, role, created_at')
          .eq('id', context.userId)
          .single();

        if (userError) throw userError;
        if (userData) {
          Object.entries(userData).forEach(([key, value]) => {
            if (params.fields.includes(key)) {
              responseData[key] = value;
            }
          });
        }
      }

      // Fetch tasks if requested
      if (params.fields.includes('tasks')) {
        const { data, error } = await context.supabase
          .from('task_assignees')
          .select(`
            task_id,
            role,
            tasks (
              id,
              title,
              description,
              status,
              priority,
              risk_level,
              start_date,
              due_date,
              workload,
              module,
              created_at,
              updated_at
            )
          `)
          .eq('user_id', context.userId)
          .order('tasks(created_at)', { ascending: false });

        if (error) throw error;

        const assignedTasks = data?.map(item => ({
          ...item.tasks,
          assignee_role: item.role,
        })) || [];
        responseData.tasks = assignedTasks;
      }

      // Add default values for workload if requested
      if (params.fields.includes('workload')) {
        responseData.workload = 0;
      }

      // Save success response - use data_response type
      const responseContent = {
        type: 'data_response',
        data: responseData
      };

      console.log('Saving data response message:', responseContent);

      const savedResponseMessage = await this.saveMessage(
        JSON.stringify(responseContent),
        'tool',
        context
      );

      console.log('Saved data response message:', savedResponseMessage);

      messages.push(savedResponseMessage);

    } catch (error) {
      console.error('Error fetching data:', error);
      // Save error message - use tool_result type for errors
      const errorContent = {
        type: 'tool_result',
        tool_call_id: requestCall.id,
        status: 'error',
        message: error instanceof Error ? error.message : '获取数据失败'
      };

      console.log('Saving error message:', errorContent);

      const savedErrorMessage = await this.saveMessage(
        JSON.stringify(errorContent),
        'tool',
        context
      );

      console.log('Saved error message:', savedErrorMessage);

      messages.push(savedErrorMessage);
      throw error;
    }

    return messages;
  }
}
