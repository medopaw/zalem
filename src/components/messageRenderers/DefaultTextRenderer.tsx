import { MessageContent } from '../../types/messageContentTypes';
import { DisplayMessage } from '../../types/messageStructures';

interface DefaultTextRendererProps {
  content: MessageContent;
  message?: DisplayMessage;
}

/**
 * 默认文本渲染器
 * 用于渲染纯文本消息或没有找到对应渲染器的消息
 */
function DefaultTextRenderer({ content, message }: DefaultTextRendererProps) {
  const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  const isUser = message?.role === 'user';

  return (
    <div className={`rounded-lg p-4 ${
      isUser
        ? 'bg-blue-600 text-white rounded-lg'
        : 'bg-gray-100 text-gray-900 rounded-r-lg'
    }`}>
      <p className="whitespace-pre-wrap">{text}</p>
    </div>
  );
}

export default DefaultTextRenderer;
