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
    currentThreadRef.current = threadId;
    setError(null);
    
    try {
      chatManagerRef.current = new ChatManager(userId!, threadId);
      const { messages: loadedMessages, error } = await chatManagerRef.current.loadMessages();
      
      if (error) {
        setError(error);
        return;
      }
      
      setMessagesByThread(prev => ({
        ...prev,
        [threadId]: loadedMessages
      }));
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