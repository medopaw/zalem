import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Send, Loader2 } from 'lucide-react';
import { initializeChatService } from '../services/ChatService';
import ThreadList from '../components/ThreadList';
import MessageList from '../components/MessageList';
import { useThreads } from '../hooks/useThreads';
import { useMessages } from '../hooks/useMessages';

function Chat() {
  const { user } = useAuth();
  const [isThreadListCollapsed, setIsThreadListCollapsed] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  // const [userNickname, setUserNickname] = useState<string | null>(null);
  const [chatServiceState, setChatServiceState] = useState<{
    initialized: boolean;
    error: string | null;
  }>({
    initialized: false,
    error: null
  });
  const [shouldFocus, setShouldFocus] = useState(false);
  const [isCreatingThread, setIsCreatingThread] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    threads,
    currentThreadId,
    loading: threadsLoading,
    error: threadError,
    createThread,
    selectThread
  } = useThreads();

  const {
    messages,
    loading,
    error: messageError,
    isNetworkError,
    lastFailedMessage,
    sendMessage,
    loadMessages,
    retryLastMessage
  } = useMessages(user?.id);
  // const [hasWelcomeMessageRef] = useState({ current: false });

  useEffect(() => {
    const initialize = async () => {
      try {
        await initializeChatService(supabase);
        setChatServiceState({ initialized: true, error: null });
      } catch (error) {
        console.error('Failed to initialize chat service:', error);
        setChatServiceState({
          initialized: false,
          error: error instanceof Error ? error.message : 'Failed to initialize chat service'
        });
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    if (currentThreadId && !threadsLoading && chatServiceState.initialized) {
      // 使用当前的 threadId 加载消息
      loadMessages(currentThreadId)
      .then(() => {
        // Set focus to input after messages are loaded
        setShouldFocus(true);
      })
      .catch(error => {
        console.error('Failed to load messages:', error);
      });
    }
  // 移除 loadMessages 依赖项，防止无限循环
  }, [currentThreadId, threadsLoading, chatServiceState.initialized]);

  const handleCreateThread = async () => {
    try {
      // 显示加载状态
      setIsCreatingThread(true);
      console.log('Creating new thread...');

      // 创建新线程
      const newThreadId = await createThread();
      console.log('New thread created:', newThreadId);

      if (newThreadId) {
        // 等待一下，确保线程创建完成
        await new Promise(resolve => setTimeout(resolve, 500));

        // 加载新线程的消息
        console.log('Loading messages for new thread...');
        await loadMessages(newThreadId);
        console.log('Messages loaded for new thread');

        // 设置焦点到输入框
        setShouldFocus(true);
      }
    } catch (error) {
      console.error('Failed to create thread:', error);
    } finally {
      setIsCreatingThread(false);
    }
  };
  const handleSelectThread = async (threadId: string) => {
    await selectThread(threadId);
    await loadMessages(threadId);
    setShouldFocus(true);
  };

  // Only focus when explicitly requested
  useEffect(() => {
    if (shouldFocus && textareaRef.current) {
      textareaRef.current.focus();
      setShouldFocus(false);
    }
  }, [shouldFocus]);

  // 未使用的函数，保留注释以供参考
  /*
  const checkUserNickname = async () => {
    if (!user) return;

    if (!currentThreadId) {
      return;
    }

    // Load existing messages
    await loadMessages(currentThreadId);

    // Only proceed if there are no messages
    if (messages.length > 0) {
      hasWelcomeMessageRef.current = true;
      return;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('nickname')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      // setUserNickname(data?.nickname);

      if (!hasWelcomeMessageRef.current) {
        const welcomeMessage = data?.nickname
          ? `欢迎回来，${data.nickname}！您一定很忙吧。最近在忙什么呢？` :
          "欢迎！我注意到您还没有设置昵称。您希望我怎么称呼您？";

        const { data: messageData, error: messageError } = await supabase
          .from('chat_messages')
          .insert([
            {
              content: welcomeMessage,
              role: 'assistant',
              user_id: user.id,
              thread_id: currentThreadId,
            },
          ])
          .select()
          .single();

        if (!messageError && messageData) {
          // setMessages(prev => [...prev, messageData]);
          hasWelcomeMessageRef.current = true;
        }
      }
    } catch (error) {
      console.error('Error checking nickname:', error);
    }
  };
  */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || loading || !currentThreadId || !user?.id) return;
    setShouldFocus(true);
    const content = newMessage;
    setNewMessage('');
    await sendMessage(content, currentThreadId);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Allow Shift+Enter for new line
        return;
      }
      // Enter without shift submits the form
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Store current scroll position
    const scrollPos = textarea.scrollTop;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';

    // Calculate the new height
    const baseHeight = 42; // Initial height (matches current input height)
    const maxHeight = baseHeight * 3;
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);

    textarea.style.height = `${newHeight}px`;

    // Restore scroll position
    textarea.scrollTop = scrollPos;
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    adjustTextareaHeight();
  };

  return (
    <div className="h-full flex relative overflow-hidden">
      <ThreadList
        threads={threads}
        currentThreadId={currentThreadId}
        isCollapsed={isThreadListCollapsed}
        isLoading={isCreatingThread}
        onCreateThread={handleCreateThread}
        onSelectThread={handleSelectThread}
        onToggleCollapse={() => setIsThreadListCollapsed(!isThreadListCollapsed)}
      />

      <div className="flex-1 bg-white shadow-md h-full rounded-r-lg">
        <div className="flex flex-col h-full rounded-r-lg overflow-hidden">
          {chatServiceState.error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
              <strong className="font-bold">初始化错误!</strong>
              <span className="block sm:inline"> {chatServiceState.error}</span>
            </div>
          )}

          {chatServiceState.initialized && (
            <>
              <div className="flex-1 overflow-hidden rounded-tr-lg">
                <MessageList
                  messages={messages}
                  error={messageError || threadError}
                  isNetworkError={isNetworkError}
                  onRetry={lastFailedMessage ? retryLastMessage : undefined}
                />
              </div>

              <div className="border-t bg-white rounded-br-lg">
                <form onSubmit={handleSubmit} className="flex gap-2 p-4">
                  <textarea
                    rows={1}
                    ref={textareaRef}
                    value={newMessage}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[42px] max-h-[126px] overflow-y-auto"
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Chat;
