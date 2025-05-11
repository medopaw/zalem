import { useState } from 'react';
import { ToolCallContent } from '../../types/messageContentTypes';

interface ToolCallRendererProps {
  content: ToolCallContent;
}

/**
 * 渲染工具调用消息
 */
function ToolCallRenderer({ content }: ToolCallRendererProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="flex flex-col">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="inline-flex items-center gap-2 px-2.5 py-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded cursor-pointer hover:from-blue-600 hover:to-cyan-600 transition-all text-xs font-medium shadow-sm"
      >
        <span>执行功能: {content.name}</span>
        {(content.name === 'setNickname' || content.name === 'set_nickname') && (
          <span className="text-blue-100 text-xs">
            ({String(content.parameters.nickname)})
          </span>
        )}
      </div>
      {isExpanded && (
        <div className="mt-1 p-2 bg-blue-50 rounded text-xs font-mono text-blue-700">
          {JSON.stringify(content.parameters, null, 2)}
        </div>
      )}
    </div>
  );
}

export default ToolCallRenderer;
