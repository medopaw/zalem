# 新对话第一条消息机制设计

## 1. 概述

本文档描述了一种新的机制，用于在新对话创建时自动生成和展示第一条消息。这种机制旨在提供更自然的对话开始体验，同时解决技术上的限制问题。

## 2. 需求

1. 第一条消息需要是用户发的，但不展示出来，以确保function calling正常工作
2. 实际展示的第一条消息是大模型回复上述隐藏消息的内容
3. 展示的第一条消息要体现对用户的关心，内容要多样化
4. 展示的第一条消息要尽快显示出来，理想情况下在新对话创建后立即显示
5. 需要一个后台任务系统来准备这些消息，不依赖用户主动触发

## 3. 技术设计

### 3.1 数据模型扩展

#### 3.1.1 消息可见性标志

在`chat_messages`表中添加一个新的字段：

```sql
ALTER TABLE chat_messages
ADD COLUMN is_visible BOOLEAN DEFAULT TRUE NOT NULL;
```

这个字段将用于控制消息在UI中是否可见。

#### 3.1.2 预生成消息表

创建一个新表用于存储预生成的消息：

```sql
CREATE TABLE IF NOT EXISTS pregenerated_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  hidden_message TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  used_at TIMESTAMPTZ,
  is_used BOOLEAN DEFAULT FALSE
);
```

### 3.2 后台任务系统

#### 3.2.1 后台任务管理器

创建一个新的`BackgroundTaskManager`类，负责管理和执行后台任务：

```typescript
class BackgroundTaskManager {
  private static instance: BackgroundTaskManager;
  private tasks: Map<string, () => Promise<void>> = new Map();
  private isRunning: boolean = false;

  private constructor() {}

  public static getInstance(): BackgroundTaskManager {
    if (!BackgroundTaskManager.instance) {
      BackgroundTaskManager.instance = new BackgroundTaskManager();
    }
    return BackgroundTaskManager.instance;
  }

  public registerTask(taskId: string, task: () => Promise<void>): void {
    this.tasks.set(taskId, task);
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    this.runTasks();
  }

  private async runTasks(): Promise<void> {
    while (this.isRunning) {
      for (const [taskId, task] of this.tasks.entries()) {
        try {
          await task();
        } catch (error) {
          console.error(`Error executing task ${taskId}:`, error);
        }
      }

      // 等待一段时间再执行下一轮任务
      await new Promise(resolve => setTimeout(resolve, 60000)); // 1分钟
    }
  }

  public stop(): void {
    this.isRunning = false;
  }
}
```

#### 3.2.2 预生成消息任务

创建一个专门用于预生成消息的任务：

```typescript
class PregenerateMessagesTask {
  private static readonly TASK_ID = 'pregenerate-messages';
  private static readonly MIN_MESSAGES_PER_USER = 3; // 每个用户至少保持的预生成消息数量
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;

    // 注册任务
    BackgroundTaskManager.getInstance().registerTask(
      PregenerateMessagesTask.TASK_ID,
      this.execute.bind(this)
    );
  }

  public async execute(): Promise<void> {
    try {
      // 获取所有活跃用户
      const { data: users, error: usersError } = await this.supabase
        .from('users')
        .select('id');

      if (usersError) throw usersError;

      // 为每个用户检查并生成消息
      for (const user of users) {
        await this.ensureMessagesForUser(user.id);
      }
    } catch (error) {
      console.error('Error in pregenerate messages task:', error);
    }
  }

  private async ensureMessagesForUser(userId: string): Promise<void> {
    // 检查用户当前的预生成消息数量
    const { data: messages, error: countError } = await this.supabase
      .from('pregenerated_messages')
      .select('id')
      .eq('user_id', userId)
      .eq('is_used', false);

    if (countError) throw countError;

    const currentCount = messages?.length || 0;
    const neededCount = PregenerateMessagesTask.MIN_MESSAGES_PER_USER - currentCount;

    // 如果需要，生成更多消息
    if (neededCount > 0) {
      for (let i = 0; i < neededCount; i++) {
        await this.generateMessagePair(userId);
      }
    }
  }

  private async generateMessagePair(userId: string): Promise<void> {
    try {
      // 获取用户信息
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('nickname')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      // 生成隐藏的用户消息
      const hiddenMessage = this.generateHiddenUserMessage();

      // 获取AI响应
      const chatService = getChatService();
      const aiResponse = await this.getAIResponse(hiddenMessage, userData?.nickname);

      // 保存预生成的消息对
      await this.supabase
        .from('pregenerated_messages')
        .insert([{
          user_id: userId,
          hidden_message: hiddenMessage,
          ai_response: aiResponse,
          is_used: false
        }]);
    } catch (error) {
      console.error('Error generating message pair:', error);
    }
  }

  private generateHiddenUserMessage(): string {
    // 这个消息不会显示给用户，但会发送给AI以获取响应
    return "你好，我刚开始一个新的对话。请用友好的方式问候我，询问我最近在忙什么或者我的状态，但不要让你的回复看起来像是在回答我的问题。";
  }

  private async getAIResponse(hiddenMessage: string, nickname?: string): Promise<string> {
    const chatService = getChatService();
    const systemPrompt = `你是一个友好的AI助手。用户刚刚开始了一个新的对话。
请用简短友好的方式问候用户${nickname ? `（昵称：${nickname}）` : ''}，询问最近在忙什么或者当前状态。
你的回复应该自然，不要超过2-3句话，不要看起来像是在回答问题。`;

    // 使用封装好的sendSingleMessage方法
    const response = await chatService.sendSingleMessage(systemPrompt, hiddenMessage);
    return response.content || "你好！最近怎么样？有什么我能帮到你的吗？";
  }
}
```

### 3.3 消息处理流程

#### 3.3.1 创建新对话时使用预生成消息

修改`ThreadRepository`类，添加使用预生成消息的方法：

```typescript
class SupabaseThreadRepository implements IThreadRepository {
  // ... 现有代码 ...

  /**
   * 创建新对话并应用预生成的消息
   */
  async createThreadWithPregenerated(userId: string): Promise<string> {
    // 使用事务确保操作的原子性
    const { data, error } = await this.supabase.rpc('create_thread_with_pregenerated', {
      p_user_id: userId
    });

    if (error) throw error;
    return data;
  }
}
```

在数据库中创建相应的存储过程：

```sql
CREATE OR REPLACE FUNCTION create_thread_with_pregenerated(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_thread_id UUID;
  v_new_thread_id UUID;
  v_pregenerated RECORD;
BEGIN
  -- 获取当前活跃对话
  SELECT id INTO v_old_thread_id
  FROM chat_threads
  WHERE created_by = p_user_id
  AND is_archived = false;

  -- 归档旧对话
  IF v_old_thread_id IS NOT NULL THEN
    UPDATE chat_threads
    SET is_archived = true
    WHERE id = v_old_thread_id;
  END IF;

  -- 创建新对话
  INSERT INTO chat_threads (
    title,
    created_by,
    is_archived
  ) VALUES (
    '新对话',
    p_user_id,
    false
  )
  RETURNING id INTO v_new_thread_id;

  -- 获取一个未使用的预生成消息对
  SELECT id, hidden_message, ai_response INTO v_pregenerated
  FROM pregenerated_messages
  WHERE user_id = p_user_id
  AND is_used = false
  ORDER BY created_at
  LIMIT 1;

  -- 如果找到预生成消息，则使用它
  IF v_pregenerated.id IS NOT NULL THEN
    -- 插入隐藏的用户消息
    INSERT INTO chat_messages (
      content,
      role,
      user_id,
      thread_id,
      is_visible
    ) VALUES (
      v_pregenerated.hidden_message,
      'user',
      p_user_id,
      v_new_thread_id,
      FALSE
    );

    -- 插入AI响应
    INSERT INTO chat_messages (
      content,
      role,
      user_id,
      thread_id,
      is_visible
    ) VALUES (
      v_pregenerated.ai_response,
      'assistant',
      p_user_id,
      v_new_thread_id,
      TRUE
    );

    -- 标记预生成消息为已使用
    UPDATE pregenerated_messages
    SET is_used = TRUE,
        used_at = NOW()
    WHERE id = v_pregenerated.id;
  END IF;

  RETURN v_new_thread_id;
END;
$$;
```

#### 3.3.2 修改消息加载逻辑

修改`MessageRepository`类，在加载消息时只返回可见的消息：

```typescript
class SupabaseMessageRepository implements IMessageRepository {
  // ... 现有代码 ...

  /**
   * 加载对话消息
   */
  async loadMessages(threadId: string): Promise<ChatMessage[]> {
    const { data, error } = await this.supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .eq('is_visible', true) // 只加载可见消息
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }
}
```

### 3.4 应用启动时初始化后台任务

在应用启动时初始化后台任务系统：

```typescript
// src/main.ts 或 App.tsx
import { BackgroundTaskManager } from './services/background/BackgroundTaskManager';
import { PregenerateMessagesTask } from './services/background/PregenerateMessagesTask';
import { supabase } from './lib/supabase';

// 初始化预生成消息任务
new PregenerateMessagesTask(supabase);

// 启动后台任务管理器
BackgroundTaskManager.getInstance().start();
```

## 4. 用户体验考虑

### 4.1 消息多样性

为确保第一条消息的多样性，AI响应生成时会使用专门设计的系统提示，鼓励生成不同的问候语。此外，每次生成都会包含用户的昵称（如果有），使消息更加个性化。

### 4.2 加载状态处理

如果新对话创建时预生成的消息尚未准备好，UI应显示加载状态，直到消息准备就绪。这可以通过在`ThreadList`组件中添加加载指示器来实现。

### 4.3 错误处理

如果预生成消息过程中出现错误，系统应该能够优雅地降级，使用默认的欢迎消息。

## 5. 实现计划

1. 数据库模式更新
   - 添加`is_visible`字段到`chat_messages`表
   - 创建`pregenerated_messages`表

2. 后台任务系统实现
   - 创建`BackgroundTaskManager`类
   - 实现`PregenerateMessagesTask`类

3. 存储库更新
   - 修改`ThreadRepository`以支持预生成消息
   - 更新`MessageRepository`以只加载可见消息

4. UI更新
   - 确保`MessageList`组件正确处理加载状态

5. 应用初始化
   - 在应用启动时设置后台任务系统

## 6. 测试计划

1. 单元测试
   - 测试`BackgroundTaskManager`的任务注册和执行
   - 测试`PregenerateMessagesTask`的消息生成逻辑

2. 集成测试
   - 测试创建新对话时预生成消息的应用
   - 测试消息加载过滤逻辑

3. 端到端测试
   - 测试完整的用户流程，从创建新对话到看到第一条消息

## 7. 性能考虑

1. 预生成消息任务应该在后台低优先级运行，避免影响主应用性能
2. 应限制每个用户的预生成消息数量，避免数据库膨胀
3. 定期清理长时间未使用的预生成消息

## 8. 安全考虑

1. 确保所有数据库操作都受到适当的行级安全策略保护
2. 预生成的消息应该只能被其所有者访问
3. 隐藏消息不应该在任何情况下暴露给用户界面
