import { BackgroundTaskManager } from './BackgroundTaskManager';
import { PregenerateMessagesTask } from './PregenerateMessagesTask';
import { supabase } from '../../lib/supabase';

// 跟踪任务初始化状态
let tasksInitialized = false;

/**
 * 初始化后台任务系统
 * 在应用启动时调用此函数
 */
export function initBackgroundTasks(): void {
  // 防止重复初始化任务
  if (tasksInitialized) {
    console.log('Background tasks already initialized, skipping task registration');
    return;
  }

  console.log('Initializing background tasks system');

  // 初始化预生成消息任务
  new PregenerateMessagesTask(supabase);

  // 启动后台任务管理器
  // start 方法已经有防止重复启动的机制
  BackgroundTaskManager.getInstance().start();

  // 标记任务已初始化
  tasksInitialized = true;

  console.log('Background tasks system initialized');
}
