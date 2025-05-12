/**
 * 后台任务管理器
 * 负责管理和执行后台任务
 */
export class BackgroundTaskManager {
  private static instance: BackgroundTaskManager;
  private tasks: Map<string, () => Promise<void>> = new Map();
  private isRunning: boolean = false;

  private constructor() {
    // 私有构造函数，防止直接实例化
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): BackgroundTaskManager {
    if (!BackgroundTaskManager.instance) {
      BackgroundTaskManager.instance = new BackgroundTaskManager();
    }
    return BackgroundTaskManager.instance;
  }

  /**
   * 注册一个后台任务
   * @param taskId 任务ID
   * @param task 任务函数
   */
  public registerTask(taskId: string, task: () => Promise<void>): void {
    this.tasks.set(taskId, task);
    console.log(`Task registered: ${taskId}`);
  }

  /**
   * 启动后台任务管理器
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Background task manager is already running');
      return;
    }

    console.log('Starting background task manager');
    this.isRunning = true;
    this.runTasks();
  }

  /**
   * 执行所有注册的任务
   */
  private async runTasks(): Promise<void> {
    let cycleCount = 0;

    while (this.isRunning) {
      cycleCount++;
      const taskCount = this.tasks.size;
      console.log(`[Cycle ${cycleCount}] Running ${taskCount} background tasks`);

      if (taskCount === 0) {
        console.log('No tasks registered, waiting for next cycle');
      } else {
        const startTime = Date.now();

        // 使用 requestAnimationFrame 确保任务执行不会触发不必要的渲染
        await new Promise<void>(resolve => {
          // 使用 requestAnimationFrame 确保在下一帧执行，避免阻塞渲染
          requestAnimationFrame(async () => {
            for (const [taskId, task] of this.tasks.entries()) {
              try {
                console.log(`[Cycle ${cycleCount}] Executing task: ${taskId}`);
                const taskStartTime = Date.now();
                await task();
                const taskDuration = Date.now() - taskStartTime;
                console.log(`[Cycle ${cycleCount}] Task completed: ${taskId} (took ${taskDuration}ms)`);
              } catch (error) {
                console.error(`[Cycle ${cycleCount}] Error executing task ${taskId}:`, error);
              }
            }

            const cycleDuration = Date.now() - startTime;
            console.log(`[Cycle ${cycleCount}] All tasks completed in ${cycleDuration}ms`);
            resolve();
          });
        });
      }

      // 等待一段时间再执行下一轮任务
      const waitTime = 60000; // 1分钟
      console.log(`[Cycle ${cycleCount}] Waiting ${waitTime}ms for next task execution cycle`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  /**
   * 停止后台任务管理器
   */
  public stop(): void {
    console.log('Stopping background task manager');
    this.isRunning = false;
  }

  /**
   * 移除任务
   * @param taskId 要移除的任务ID
   * @returns 是否成功移除
   */
  public unregisterTask(taskId: string): boolean {
    if (this.tasks.has(taskId)) {
      this.tasks.delete(taskId);
      console.log(`Task unregistered: ${taskId}`);
      return true;
    }
    console.log(`Task not found: ${taskId}`);
    return false;
  }

  /**
   * 获取当前注册的所有任务ID
   * @returns 任务ID数组
   */
  public getRegisteredTaskIds(): string[] {
    return Array.from(this.tasks.keys());
  }
}
