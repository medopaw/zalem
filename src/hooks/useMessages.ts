import { useState, useRef, useCallback } from 'react';
import { ChatMessage } from '../types/chat';
import { ChatManager } from '../services/ChatManager';

export function useMessages(userId: string | undefined) {
  const [messagesByThread, setMessagesByThread] = useState<Record<string, ChatMessage[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatManagerRef = useRef<ChatManager | null>(null);
  const currentThreadRef = useRef<string | null>(null);

  const loadMessages = async (threadId: string | null) => {
    if (!threadId) return;

    // 只有当 Thread ID 变化或者 chatManager 不存在时才创建新的 ChatManager 实例
    if (currentThreadRef.current !== threadId || !chatManagerRef.current) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`Creating new ChatManager for thread ${threadId}`);
      }
      chatManagerRef.current = new ChatManager(userId!, threadId);
      currentThreadRef.current = threadId;
    }

    setError(null);

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log(`Loading messages for thread ${threadId}...`);
      }
      const { messages: loadedMessages, error } = await chatManagerRef.current.loadMessages();

      if (error) {
        console.error('Error loading messages:', error);
        setError(error);
        return;
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`Loaded ${loadedMessages.length} messages for thread ${threadId}`);
      }

      setMessagesByThread(prev => ({
        ...prev,
        [threadId]: loadedMessages
      }));

      // 如果没有消息，尝试再次加载，但只尝试一次
      if (loadedMessages.length === 0) {
        // 使用一个标记来记录是否已经重试过
        const threadKey = `retry_${threadId}`;
        const hasRetried = sessionStorage.getItem(threadKey);

        if (!hasRetried) {
          console.log('No messages found, trying to reload once after a short delay...');
          sessionStorage.setItem(threadKey, 'true');

          setTimeout(async () => {
            try {
              const { messages: retryMessages, error: retryError } = await chatManagerRef.current!.loadMessages();
              if (!retryError && retryMessages.length > 0) {
                console.log(`Reloaded ${retryMessages.length} messages for thread ${threadId}`);
                setMessagesByThread(prev => ({
                  ...prev,
                  [threadId]: retryMessages
                }));
              } else {
                console.log(`Retry complete, still no messages for thread ${threadId}`);
              }
            } catch (retryError) {
              console.error('Error in retry loading messages:', retryError);
            }
          }, 1000);
        } else {
          console.log(`Already retried loading messages for thread ${threadId}, not retrying again`);
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setError('Failed to load messages');
    }
  };

  const sendMessage = useCallback(async (
    content: string,
    threadId: string | null
  ) => {
    if (!content.trim() || loading || !threadId || !userId) return;
    currentThreadRef.current = threadId;

    setLoading(true);
    setError(null);

    // Create and add temporary message to UI immediately
    const tempMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      content,
      role: 'user',
      created_at: new Date().toISOString(),
      user_id: userId,
      thread_id: threadId
    };

    setMessagesByThread(prev => ({
      ...prev,
      [threadId]: [...(prev[threadId] || []), tempMessage]
    }));

    try {
      const newMessages = await chatManagerRef.current?.sendMessage(content);
      if (newMessages?.length) {
        // Replace temp message with real messages
        setMessagesByThread(prev => {
          const threadMessages = prev[threadId] || [];
          const withoutTemp = threadMessages.filter(msg => msg.id !== tempMessage.id);
          return {
            ...prev,
            [threadId]: [...withoutTemp, ...newMessages]
          };
        });
      }
    } catch (error) {
      console.error('Error in chat:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while sending message');
      // Remove temporary message on error
      setMessagesByThread(prev => ({
        ...prev,
        [threadId]: (prev[threadId] || []).filter(msg => msg.id !== tempMessage.id)
      }));
    } finally {
      setLoading(false);
    }
  }, [loading, userId]);

  const clearMessages = async (threadId: string) => {
    if (!window.confirm('Are you sure you want to clear the chat history?')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await chatManagerRef.current?.clearMessages();
      setMessagesByThread(prev => ({
        ...prev,
        [threadId]: []
      }));
    } catch (error) {
      console.error('Error clearing chat history:', error);
      setError('Failed to clear chat history');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    messages: messagesByThread[currentThreadRef.current || ''] || [],
    loading,
    error,
    sendMessage,
    loadMessages,
    clearMessages
  };
}
