import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase, checkSupabaseConnection } from '../lib/supabase';
import type { ThreadUpdatedEventDetail } from '../types/events';

export interface Thread {
  id: string;
  title: string;
  updated_at: string;
}

export function useThreads() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
  }, []);

  const loadThreads = async () => {
    try {
      // First check if Supabase is connected
      const isConnected = await checkSupabaseConnection();
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
      const { data, error } = await supabase.rpc('create_chat_thread');
      
      if (error) throw error;
      
      await loadThreads();
      return data;
    } catch (error) {
      console.error('Error creating thread:', error);
      setError('Failed to create new thread');
      throw error;
    }
  };

  const handleCreateThread = async () => {
    const newThreadId = await createThread();
    if (newThreadId) {
      await loadThreads();
      setCurrentThreadId(newThreadId);
      setSearchParams({ thread: newThreadId });
      return newThreadId;
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
    createThread: handleCreateThread,
    selectThread: handleSelectThread,
    loadThreads
  };
}