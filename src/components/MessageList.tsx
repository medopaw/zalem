import React, { useRef, useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { ChatMessage } from '../types/chat';
import MessageContent from './MessageContent';

interface MessageListProps {
  messages: ChatMessage[];
  error: string | null;
  isNetworkError?: boolean;
  onRetry?: () => void;
}

function MessageList({ messages, error, isNetworkError = false, onRetry }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex justify-between items-start">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
              {isNetworkError && onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-1 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-md text-sm transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  重试
                </button>
              )}
            </div>
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            } mb-3`}
          >
            <div className="max-w-[80%]">
              <MessageContent message={message} />
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

export default MessageList;
