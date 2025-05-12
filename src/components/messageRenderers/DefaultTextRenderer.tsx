import { MessageContent } from '../../types/messageContentTypes';
import { DisplayMessage } from '../../types/messageStructures';
import { useDebugMode } from '../../contexts/DebugContext';
import { useRef } from 'react';
import React from 'react';

interface DefaultTextRendererProps {
  content: MessageContent;
  message?: DisplayMessage;
}

/**
 * 默认文本渲染器
 * 用于渲染纯文本消息或没有找到对应渲染器的消息
 */
const DefaultTextRenderer = React.memo(function DefaultTextRenderer({ content, message }: DefaultTextRendererProps) {
  // 获取调试模式状态
  const { isDebugMode } = useDebugMode();

  // 使用 useRef 跟踪渲染次数
  const renderCount = useRef(0);
  renderCount.current += 1;

  // 输出渲染次数到控制台（无论调试模式是否开启）
  console.log(`DefaultTextRenderer rendered ${renderCount.current} times for message: ${message?.id || 'unknown'}`);

  const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  const isUser = message?.role === 'user';

  return (
    <div className={`rounded-lg p-4 ${
      isUser
        ? 'bg-blue-600 text-white rounded-lg'
        : 'bg-gray-100 text-gray-900 rounded-r-lg'
    }`}>
      <p className="whitespace-pre-wrap">
        {text}
        {isDebugMode && (
          <span className="block mt-2 text-xs opacity-50">
            渲染次数: {renderCount.current}
          </span>
        )}
      </p>
    </div>
  );
});

export default DefaultTextRenderer;
