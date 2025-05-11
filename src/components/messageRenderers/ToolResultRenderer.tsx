import { ToolResultContent } from '../../types/messageContentTypes';
import logger from '../../utils/logger';

interface ToolResultRendererProps {
  content: ToolResultContent;
}

/**
 * 渲染工具调用结果消息
 */
function ToolResultRenderer({ content }: ToolResultRendererProps) {
  // 使用智能日志系统，避免重复日志
  logger.debug('Rendering tool result', [{
    type: content.type,
    status: content.status,
    message: content.message
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
        <span>{content.message}</span>
      </div>
    </div>
  );
}

export default ToolResultRenderer;
