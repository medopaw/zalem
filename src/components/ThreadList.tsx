import React from 'react';
import { MessageSquare, Plus, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface Thread {
  id: string;
  title: string;
  updated_at: string;
}

interface ThreadListProps {
  threads: Thread[];
  currentThreadId: string | null;
  isCollapsed: boolean;
  isLoading?: boolean;
  onCreateThread: () => void;
  onSelectThread: (threadId: string) => void;
  onToggleCollapse: () => void;
}

function ThreadList({
  threads,
  currentThreadId,
  isCollapsed,
  isLoading = false,
  onCreateThread,
  onSelectThread,
  onToggleCollapse,
}: ThreadListProps) {
  return (
    <div
      className={`bg-gray-800 text-white transition-all duration-300 flex flex-col rounded-tl-lg rounded-bl-lg shadow-md ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        {!isCollapsed && <h2 className="text-lg font-semibold">聊天记录</h2>}
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </button>
      </div>

      <div className="p-2 flex-1 overflow-hidden flex flex-col">
        <button
          onClick={onCreateThread}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Plus className="w-5 h-5" />
          )}
          {!isCollapsed && <span>{isLoading ? '创建中...' : '新对话'}</span>}
        </button>

        <div className="space-y-2 overflow-y-auto flex-1">
          {threads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => onSelectThread(thread.id)}
              className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors ${
                thread.id === currentThreadId
                  ? 'bg-gray-600'
                  : 'hover:bg-gray-700'
              }`}
            >
              <MessageSquare className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <div className="font-medium truncate">
                    {thread.title || '新对话'}
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(thread.updated_at), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ThreadList;
