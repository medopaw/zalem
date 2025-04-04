import { BaseHandler } from './BaseHandler';
import type { MessageContext, ChatMessage, LLMMessage } from '../../types/messages';

/**
 * Handles data request messages
 */
export class DataRequestHandler extends BaseHandler {
  canHandle(message: LLMMessage): boolean {
    return message.tool_calls?.some(call => 
      call.function.name === 'requestData'
    ) || false;
  }

  async handle(message: LLMMessage, context: MessageContext): Promise<ChatMessage[]> {
    const messages: ChatMessage[] = [];

    // Save the original message if present
    if (message.content) {
      messages.push(await this.saveMessage(message.content, 'assistant', context));
    }

    // Find the requestData tool call
    const requestCall = message.tool_calls?.find(call => 
      call.function.name === 'requestData'
    );

    if (!requestCall) {
      throw new Error('No requestData tool call found');
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

      // Save success response
      messages.push(await this.saveMessage(
        JSON.stringify({
          type: 'execution_result',
          status: 'success',
          message: '数据获取成功',
          data: responseData
        }),
        'assistant',
        context
      ));

    } catch (error) {
      console.error('Error fetching data:', error);
      // Save error message
      messages.push(await this.saveMessage(
        JSON.stringify({
          type: 'execution_result',
          status: 'error',
          message: error instanceof Error ? error.message : '获取数据失败'
        }),
        'assistant',
        context
      ));
      throw error;
    }

    return messages;
  }
}