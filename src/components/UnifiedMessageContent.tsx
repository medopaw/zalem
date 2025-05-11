import { DisplayMessage } from '../types/messageStructures';
import { ChatMessage } from '../types/chat';
import { messageTypeRegistry, DefaultTextMark } from '../utils/MessageTypeRegistry';
import { toDisplayMessage } from '../types/messageStructures';
import DefaultTextRenderer from './messageRenderers/DefaultTextRenderer';

// 确保消息处理器已注册
import '../utils/registerMessageHandlers';

interface UnifiedMessageContentProps {
  message: ChatMessage | DisplayMessage;
}

/**
 * 统一的消息内容渲染组件
 * 使用 MessageTypeRegistry 来渲染不同类型的消息
 */
function UnifiedMessageContent({ message }: UnifiedMessageContentProps) {
  // 检查消息类型，如果是 ChatMessage，则转换为 DisplayMessage
  const displayMessage = 'thread_id' in message
    ? toDisplayMessage(message as ChatMessage)
    : message as DisplayMessage;

  // 调试日志，查看消息内容
  console.log('Rendering message:', {
    id: displayMessage.id,
    role: displayMessage.role,
    content: displayMessage.content,
    contentType: typeof displayMessage.content === 'object' ? displayMessage.content.type : 'string'
  });

  // 这里不应该进行数据转换，而只是渲染
  // 数据转换应该在 toDisplayMessage 函数中完成
  // 这里只是为了调试，打印一些信息
  if (typeof displayMessage.content === 'object') {
    console.log('Message content details:', JSON.stringify(displayMessage.content, null, 2));
  }

  // 使用 messageTypeRegistry 渲染消息内容
  const renderResult = messageTypeRegistry.render(displayMessage.content, displayMessage);

  // 检查是否是默认文本标记
  if (renderResult && typeof renderResult === 'object' && '__isDefaultText' in renderResult) {
    const defaultTextMark = renderResult as unknown as DefaultTextMark;
    return <DefaultTextRenderer content={defaultTextMark.content} message={displayMessage} />;
  }

  return (
    <>
      {renderResult}
    </>
  );
}

export default UnifiedMessageContent;
