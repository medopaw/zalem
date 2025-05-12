import { ToolResultContent } from '../../types/messageContentTypes';
import logger from '../../utils/logger';
import { useRef } from 'react';
import React from 'react';
import { useDebugMode } from '../../contexts/DebugContext';

interface ToolResultRendererProps {
  content: ToolResultContent;
}

/**
 * 渲染工具调用结果消息
 */
const ToolResultRenderer = React.memo(function ToolResultRenderer({ content }: ToolResultRendererProps) {
  // 获取调试模式状态
  const { isDebugMode } = useDebugMode();

  // 使用 useRef 跟踪渲染次数
  const renderCount = useRef(0);
  renderCount.current += 1;

  // 输出渲染次数到控制台（无论调试模式是否开启）
  console.log(`ToolResultRenderer rendered ${renderCount.current} times for message: ${content.message}`);

  // 使用智能日志系统，避免重复日志
  logger.debug('Rendering tool result', [{
    type: content.type,
    status: content.status,
    message: content.message,
    renderCount: renderCount.current
  }], 'ToolResultRenderer');

  const isSuccess = content.status === 'success';

  return (
    <div className="flex justify-center my-2">
      <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium
        ${isSuccess
          ? 'bg-gray-100 text-gray-600'
          : 'bg-red-50 text-red-600'}`}>
        {isSuccess
          ? <span className="w-4 h-4 mr-1">✓</span>
          : <span className="w-4 h-4 mr-1">✗</span>}
        <span>
          {content.message}
          {isDebugMode && <span className="ml-1 text-gray-500">(渲染次数: {renderCount.current})</span>}
        </span>
      </div>
    </div>
  );
});

export default ToolResultRenderer;
