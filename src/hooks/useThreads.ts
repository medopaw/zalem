import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getSupabase } from '../services/supabase';
import { checkSupabaseConnection } from '../utils/supabaseUtils';
import type { ThreadUpdatedEventDetail } from '../types/events';
import type { Thread } from '../types/threads';
import { SupabaseThreadRepository } from '../repositories/SupabaseThreadRepository';
import { PregeneratedMessageService } from '../services/PregeneratedMessageService';

export function useThreads() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreatingThread, setIsCreatingThread] = useState<boolean>(false);

  // Listen for thread updates
  useEffect(() => {
    const handleThreadUpdate = (event: CustomEvent<ThreadUpdatedEventDetail>) => {
      console.log('Thread update event received:', event.detail);
      if (event.detail.threads) {
        setThreads(event.detail.threads);
      }
    };

    window.addEventListener('thread-updated', handleThreadUpdate);

    return () => {
      window.removeEventListener('thread-updated', handleThreadUpdate);
    };
  }, []);

  useEffect(() => {
    const initializeThread = async () => {
      setLoading(true);
      try {
        // 获取 Supabase 客户端实例
        const supabase = getSupabase();

        // Get thread ID from URL or create new thread
        const threadId = searchParams.get('thread');
        if (threadId) {
          setCurrentThreadId(threadId);
        } else {
          // Get or create active thread
          const { data: newThreadId, error: threadError } = await supabase
            .rpc('get_or_create_active_thread');

          if (threadError) throw threadError;

          if (newThreadId) {
            setCurrentThreadId(newThreadId);
            setSearchParams({ thread: newThreadId });
          }
        }

        await loadThreads();
      } catch (error) {
        console.error('Failed to initialize thread:', error);
        setError('Failed to initialize thread');
      } finally {
        setLoading(false);
      }
    };

    initializeThread();
  }, [searchParams, setSearchParams]);

  const loadThreads = async () => {
    try {
      // 获取 Supabase 客户端实例
      const supabase = getSupabase();

      // First check if Supabase is connected
      const isConnected = await checkSupabaseConnection(supabase);
      if (!isConnected) {
        throw new Error('Unable to connect to Supabase');
      }

      const { data, error } = await supabase
        .from('chat_threads')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setThreads(data || []);
    } catch (error) {
      console.error('Error loading threads:', error);
      setError('Failed to load chat threads');
      throw error;
    }
  };

  const createThread = async () => {
    try {
      // 设置加载状态
      setIsCreatingThread(true);
      setError(null);

      // 获取 Supabase 客户端实例
      const supabase = getSupabase();

      // 创建线程存储库实例
      const threadRepository = new SupabaseThreadRepository(supabase);

      // 获取当前用户ID
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      try {
        // 创建预生成消息服务
        const messageService = new PregeneratedMessageService(supabase);

        // 检查是否有可用的预生成消息
        const hasMessages = await messageService.hasAvailableMessages(userId);

        // 如果没有预生成消息，则先生成一个
        if (!hasMessages) {
          console.log('No pregenerated messages available, generating one first');
          const success = await messageService.generateMessageForUser(userId);
          if (!success) {
            console.error('Failed to generate message, falling back to regular thread creation');
            const fallbackThreadId = await threadRepository.createChatThread();
            await loadThreads();
            return fallbackThreadId;
          }
        }

        // 使用预生成消息创建新对话
        console.log('Creating thread with pregenerated messages');
        const newThreadId = await threadRepository.createThreadWithPregenerated(userId);
        await loadThreads();
        return newThreadId;
      } catch (pregeneratedError) {
        console.error('Error creating thread with pregenerated messages:', pregeneratedError);
        // 如果预生成消息创建失败，回退到普通创建方式
        console.log('Falling back to regular thread creation');
        const fallbackThreadId = await threadRepository.createChatThread();
        await loadThreads();
        return fallbackThreadId;
      }
    } catch (error) {
      console.error('Error creating thread:', error);
      setError('Failed to create new thread');
      throw error;
    } finally {
      // 无论成功还是失败，都重置加载状态
      setIsCreatingThread(false);
    }
  };

  const handleCreateThread = async () => {
    try {
      console.log('Creating thread via RPC...');
      const newThreadId = await createThread();

      if (newThreadId) {
        console.log('Thread created successfully:', newThreadId);

        // 加载线程列表
        await loadThreads();

        // 设置当前线程 ID
        setCurrentThreadId(newThreadId);

        // 更新 URL 参数
        setSearchParams({ thread: newThreadId });

        return newThreadId;
      } else {
        console.error('Failed to create thread: No thread ID returned');
      }
    } catch (error) {
      console.error('Error in handleCreateThread:', error);
    }
    return null;
  };

  const handleSelectThread = async (threadId: string) => {
    setCurrentThreadId(threadId);
    setSearchParams({ thread: threadId });
    return threadId;
  };

  return {
    threads,
    currentThreadId,
    error,
    loading,
    isCreatingThread,
    createThread: handleCreateThread,
    selectThread: handleSelectThread,
    loadThreads
  };
}
