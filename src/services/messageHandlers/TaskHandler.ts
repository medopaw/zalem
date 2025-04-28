import { BaseHandler } from './BaseHandler';
import type { MessageContext, ChatMessage } from '../../types/messages';
import type { LLMMessage } from '../../types/chat';
import { getWeekRange, getQuarterRange } from '../dateUtils';

/**
 * Maps between priority descriptions and enum values
 */
const priorityMap = {
  // From description to enum
  fromDescription: {
    'high': 'p0',
    'medium': 'p1',
    'low': 'p2',
    'none': 'p3'
  },
  // Direct enum values
  fromEnum: {
    'p0': 'p0',
    'p1': 'p1',
    'p2': 'p2',
    'p3': 'p3'
  }
} as const;

/**
 * Maps between risk level descriptions and enum values
 */
const riskMap = {
  // From description to enum
  fromDescription: {
    'high': 'high',
    'medium': 'medium',
    'low': 'low'
  },
  // Direct enum values
  fromEnum: {
    'high': 'high',
    'medium': 'medium',
    'low': 'low'
  }
} as const;

/**
 * Handles task-related messages and operations
 */
export class TaskHandler extends BaseHandler {
  canHandle(message: LLMMessage): boolean {
    const TASK_FUNCTIONS = [
      'create_task',
      'update_task',
      'add_task_assignee',
      'update_task_workload',
      'update_task_schedule'
    ];

    return message.tool_calls?.some(call =>
      TASK_FUNCTIONS.includes(call.function.name)
    ) || false;
  }

  async handle(message: LLMMessage, context: MessageContext): Promise<ChatMessage[]> {
    const messages: ChatMessage[] = [];

    // Save the original message
    if (message.content) {
      messages.push(await this.saveMessage(message.content, 'assistant', context));
    }

    // Handle each tool call
    for (const call of message.tool_calls || []) {
      await this.handleToolCall(
        call.function.name,
        JSON.parse(call.function.arguments),
        context,
        messages,
        call.id
      );
    }

    return messages;
  }

  private async handleToolCall(
    functionName: string,
    parameters: any,
    context: MessageContext,
    messages: ChatMessage[],
    toolCallId: string
  ): Promise<void> {
    try {
      switch (functionName) {
        case 'create_task':
          await this.handleCreateTask(parameters, context, messages);
          break;
        case 'update_task':
          await this.handleUpdateTask(parameters, context, messages);
          break;
        case 'add_task_assignee':
          await this.handleAddTaskAssignee(parameters, context, messages);
          break;
        case 'update_task_workload':
          await this.handleUpdateTaskWorkload(parameters, context, messages);
          break;
        case 'update_task_schedule':
          await this.handleUpdateTaskSchedule(parameters, context, messages);
          break;
        default:
          throw new Error(`Unsupported function: ${functionName}`);
      }

      // Add success message with specific message
      messages.push(await this.saveMessage(
        JSON.stringify({
          type: 'tool_result',
          tool_call_id: toolCallId,
          status: 'success',
          message: this.getSuccessMessage(functionName)
        }),
        'assistant',
        context
      ));

    } catch (error) {
      console.error('Operation failed:', error);
      // Save error message
      messages.push(await this.saveMessage(
        JSON.stringify({
          type: 'tool_result',
          tool_call_id: toolCallId,
          status: 'error',
          message: error instanceof Error ? error.message : '操作失败',
          details: error instanceof Error ? error.stack : undefined
        }),
        'assistant',
        context
      ));
      // 不再重新抛出错误，而是让消息处理继续
      // throw error; // Re-throw to ensure proper error handling
    }

    return messages;
  }

  /**
   * Get success message based on function name
   */
  private getSuccessMessage(functionName: string): string {
    switch (functionName) {
      case 'create_task':
        return '任务创建成功';
      case 'update_task':
        return '任务已更新';
      case 'add_task_assignee':
        return '已添加任务协作者';
      case 'update_task_workload':
        return '任务工作量已更新';
      case 'update_task_schedule':
        return '任务计划已更新';
      default:
        return '操作成功';
    }
  }

  private async handleCreateTask(
    params: any,
    context: MessageContext,
    messages: ChatMessage[]
  ): Promise<void> {
    // Map priority and risk level
    const priority = params.priority in priorityMap.fromEnum
      ? priorityMap.fromEnum[params.priority]
      : priorityMap.fromDescription[params.priority] || 'p2';

    const riskLevel = params.risk_level in riskMap.fromEnum
      ? riskMap.fromEnum[params.risk_level]
      : riskMap.fromDescription[params.risk_level] || 'low';

    // Create task
    const { data: task, error: taskError } = await context.supabase
      .from('tasks')
      .insert([{
        title: params.title,
        description: params.description,
        priority,
        risk_level: riskLevel,
        start_date: params.start_date,
        due_date: params.due_date,
        workload: params.workload,
        created_by: context.userId
      }])
      .select()
      .single();

    if (taskError) throw taskError;

    // Add creator as task owner
    const { data: assignee, error: assigneeError } = await context.supabase
      .from('task_assignees')
      .insert([{
        task_id: task.id,
        user_id: context.userId,
        role: 'owner'
      }])
      .select()
      .single();

    if (assigneeError) throw assigneeError;

    // If workload is provided, create initial schedule
    if (params.workload) {
      const weekRange = getWeekRange(new Date());
      const quarterRange = getQuarterRange(new Date());

      await context.supabase
        .from('task_schedule')
        .insert([
          {
            task_id: task.id,
            user_id: context.userId,
            schedule_type: 'weekly',
            start_date: weekRange.start,
            end_date: weekRange.end,
            workload: params.workload
          },
          {
            task_id: task.id,
            user_id: context.userId,
            schedule_type: 'quarterly',
            start_date: quarterRange.start,
            end_date: quarterRange.end,
            workload: params.workload
          }
        ]);
    }
  }

  private async handleUpdateTask(
    params: any,
    context: MessageContext,
    messages: ChatMessage[]
  ): Promise<void> {
    const { task_id, ...updates } = params;

    // Validate task_id
    if (!task_id) {
      throw new Error('任务ID不能为空');
    }

    // Validate task_id format
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(task_id)) {
      throw new Error('无效的任务ID格式');
    }

    console.log('Updating task:', { task_id, updates });

    // Map priority if provided
    if (updates.priority) {
      const priority = updates.priority in priorityMap.fromEnum
        ? priorityMap.fromEnum[updates.priority]
        : priorityMap.fromDescription[updates.priority] || 'p2';
      console.log('Mapping priority:', updates.priority, 'to:', priority);
      updates.priority = priority;
    }

    // Map risk level if provided
    if (updates.risk_level) {
      const riskLevel = updates.risk_level in riskMap.fromEnum
        ? riskMap.fromEnum[updates.risk_level]
        : riskMap.fromDescription[updates.risk_level] || 'low';
      console.log('Mapping risk level:', updates.risk_level, 'to:', riskLevel);
      updates.risk_level = riskLevel;
    }

    // Get current task state
    const { data: currentTask, error: fetchError } = await context.supabase
      .from('tasks')
      .select('*')
      .eq('id', task_id)
      .single();

    if (fetchError) throw fetchError;
    console.log('Current task state:', currentTask);

    // Track changes for history
    if (updates.status && updates.status !== currentTask.status) {
      console.log('Recording status change:', { old: currentTask.status, new: updates.status });
      await context.supabase
        .from('task_status_history')
        .insert([{
          task_id,
          old_status: currentTask.status,
          new_status: updates.status,
          changed_by: context.userId
        }]);
    }

    if (updates.priority && updates.priority !== currentTask.priority) {
      console.log('Recording priority change:', { old: currentTask.priority, new: updates.priority });
      await context.supabase
        .from('task_priority_history')
        .insert([{
          task_id,
          old_priority: currentTask.priority,
          new_priority: updates.priority,
          changed_by: context.userId
        }]);
    }

    if (updates.risk_level && updates.risk_level !== currentTask.risk_level) {
      console.log('Recording risk level change:', { old: currentTask.risk_level, new: updates.risk_level });
      await context.supabase
        .from('task_risk_history')
        .insert([{
          task_id,
          old_risk: currentTask.risk_level,
          new_risk: updates.risk_level,
          changed_by: context.userId
        }]);
    }

    // Update task
    console.log('Updating task with:', updates);
    const { data: updatedTask, error: updateError } = await context.supabase
      .from('tasks')
      .update(updates)
      .eq('id', task_id)
      .select()
      .single();

    if (updateError) throw updateError;
    console.log('Task updated successfully:', updatedTask);

    // Success will be handled by the main handle function
  }

  private async handleAddTaskAssignee(
    params: any,
    context: MessageContext,
    messages: ChatMessage[]
  ): Promise<void> {
    // Validate task_id
    if (!params.task_id) {
      throw new Error('任务ID不能为空');
    }

    // Validate task_id format
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(params.task_id)) {
      throw new Error('无效的任务ID格式');
    }

    const { data: assignee, error } = await context.supabase
      .from('task_assignees')
      .insert([{
        task_id: params.task_id,
        user_id: params.user_id,
        role: params.role || 'assignee'
      }])
      .select()
      .single();

    if (error) throw error;
  }

  private async handleUpdateTaskWorkload(
    params: any,
    context: MessageContext,
    messages: ChatMessage[]
  ): Promise<void> {
    // Validate task_id
    if (!params.task_id) {
      throw new Error('任务ID不能为空');
    }

    // Validate task_id format
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(params.task_id)) {
      throw new Error('无效的任务ID格式');
    }

    const weekStart = new Date(params.week_start);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const quarterRange = getQuarterRange(weekStart);

    const { data: workload, error } = await context.supabase
      .from('task_workload')
      .upsert([{
        task_id: params.task_id,
        user_id: context.userId,
        workload: params.workload,
        week_start: weekStart.toISOString().split('T')[0],
        week_end: weekEnd.toISOString().split('T')[0],
        quarter_start: quarterRange.start,
        quarter_end: quarterRange.end
      }])
      .select()
      .single();

    if (error) throw error;
  }

  private async handleUpdateTaskSchedule(
    params: any,
    context: MessageContext,
    messages: ChatMessage[]
  ): Promise<void> {
    // Validate task_id
    if (!params.task_id) {
      throw new Error('任务ID不能为空');
    }

    // Validate task_id format
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(params.task_id)) {
      throw new Error('无效的任务ID格式');
    }

    const { error } = await context.supabase
      .from('task_schedule')
      .upsert([{
        task_id: params.task_id,
        user_id: context.userId,
        schedule_type: params.schedule_type,
        start_date: params.start_date,
        end_date: params.end_date,
        workload: params.workload
      }]);

    if (error) throw error;
  }
}
