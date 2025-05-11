import { useState } from 'react';
import { ToolCallsContent } from '../../types/messageContentTypes';

interface ToolCallsRendererProps {
  content: ToolCallsContent;
}

/**
 * 渲染多个工具调用消息
 */
function ToolCallsRenderer({ content }: ToolCallsRendererProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="flex flex-col space-y-2">
      {content.calls.map((call) => (
        <div key={call.id} className="flex flex-col">
          <div
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-2 px-2.5 py-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded cursor-pointer hover:from-blue-600 hover:to-cyan-600 transition-all text-xs font-medium shadow-sm"
          >
            <span>执行功能: {call.name}</span>
            {(call.name === 'set_nickname' || call.name === 'setNickname') && (
              <span className="text-blue-100 text-xs">
                ({String(call.parameters.nickname)})
              </span>
            )}
          </div>
          {isExpanded && (
            <div className="mt-1 p-2 bg-blue-50 rounded text-xs font-mono text-blue-700">
              {JSON.stringify(call.parameters, null, 2)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default ToolCallsRenderer;
