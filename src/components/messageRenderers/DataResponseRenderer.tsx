import { useState } from 'react';
import { DataResponseContent } from '../../types/messageContentTypes';

interface DataResponseRendererProps {
  content: DataResponseContent;
}

/**
 * 渲染数据响应消息
 */
function DataResponseRenderer({ content }: DataResponseRendererProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="flex flex-col">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="inline-flex items-center gap-2 px-2.5 py-1 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded cursor-pointer hover:from-emerald-600 hover:to-green-600 transition-all text-xs font-medium shadow-sm"
      >
        <span>数据响应: {Object.keys(content.data).join(', ')}</span>
      </div>
      {isExpanded && (
        <div className="mt-1 p-2 bg-emerald-50 rounded text-xs font-mono text-emerald-700">
          {JSON.stringify(content.data, null, 2)}
        </div>
      )}
    </div>
  );
}

export default DataResponseRenderer;
