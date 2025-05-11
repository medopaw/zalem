import { DisplayMessage } from '../../types/messageStructures';
import { TextMessageContent } from '../../types/messageContentTypes';

interface TextRendererProps {
  content: TextMessageContent;
  message?: DisplayMessage;
}

/**
 * 渲染纯文本消息
 */
function TextRenderer({ content, message }: TextRendererProps) {
  const role = message?.role || 'assistant';

  return (
    <div className={`rounded-lg p-4 ${
      role === 'user'
        ? 'bg-blue-600 text-white rounded-lg'
        : 'bg-gray-100 text-gray-900 rounded-r-lg'
    }`}>
      <p className="whitespace-pre-wrap">{content.text}</p>
    </div>
  );
}

export default TextRenderer;
