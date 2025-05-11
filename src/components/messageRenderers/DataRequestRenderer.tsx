import { useState } from 'react';
import { DataRequestContent } from '../../types/messageContentTypes';

interface DataRequestRendererProps {
  content: DataRequestContent;
}

/**
 * 渲染数据请求消息
 */
function DataRequestRenderer({ content }: DataRequestRendererProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="flex flex-col">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="inline-flex items-center gap-2 px-2.5 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded cursor-pointer hover:from-indigo-600 hover:to-purple-600 transition-all text-xs font-medium shadow-sm"
      >
        <span>请求数据: {content.fields.join(', ')}</span>
      </div>
      {isExpanded && (
        <div className="mt-1 p-2 bg-indigo-50 rounded text-xs font-mono text-indigo-700">
          {JSON.stringify(content.fields, null, 2)}
        </div>
      )}
    </div>
  );
}

export default DataRequestRenderer;
