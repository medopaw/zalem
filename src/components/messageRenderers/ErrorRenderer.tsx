import { useState } from 'react';
import { ErrorMessageContent } from '../../types/messageContentTypes';

interface ErrorRendererProps {
  content: ErrorMessageContent;
}

/**
 * 渲染错误消息
 * 用于显示无法识别或解析的消息内容
 */
function ErrorRenderer({ content }: ErrorRendererProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="flex flex-col">
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700">
        <div className="flex items-center mb-2">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">{content.message}</span>
        </div>
        
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-red-600 hover:text-red-800 underline"
        >
          {isExpanded ? '隐藏详情' : '查看详情'}
        </button>
        
        {isExpanded && (
          <pre className="mt-2 p-2 bg-red-100 rounded text-xs font-mono overflow-x-auto">
            {content.originalContent}
          </pre>
        )}
      </div>
    </div>
  );
}

export default ErrorRenderer;
