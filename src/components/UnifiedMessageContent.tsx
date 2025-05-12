import { useEffect, useRef, useMemo } from 'react';
import React from 'react';
import { DisplayMessage } from '../types/messageStructures';
import { ChatMessage } from '../types/chat';
import { DefaultTextMark } from '../utils/MessageTypeRegistry';
import { toDisplayMessage } from '../types/messageStructures';
import DefaultTextRenderer from './messageRenderers/DefaultTextRenderer';
import { getInitializedRegistry } from '../utils/initializeSystem';
import logger from '../utils/logger';
import { useDebugMode } from '../contexts/DebugContext';

interface UnifiedMessageContentProps {
  message: ChatMessage | DisplayMessage;
}

/**
 * 统一的消息内容渲染组件
 * 使用 MessageTypeRegistry 来渲染不同类型的消息
 */
const UnifiedMessageContent = React.memo(function UnifiedMessageContent({ message }: UnifiedMessageContentProps) {
  // 获取调试模式状态
  const { isDebugMode } = useDebugMode();

  // 使用 useRef 跟踪渲染次数
  const renderCount = useRef(0);
  renderCount.current += 1;

  // 获取已初始化的 registry 实例
  const registry = getInitializedRegistry();

  // 输出渲染次数到控制台（无论调试模式是否开启）
  console.log(`UnifiedMessageContent rendered ${renderCount.current} times for message: ${message.id}`);

  // 不再需要使用ref来跟踪日志输出，因为我们使用了智能日志系统

  // 确保消息处理器已注册
  useEffect(() => {
    // 获取注册的类型
    const registeredTypes = registry.getRegisteredTypes();

    // 使用智能日志系统，避免重复日志
    logger.info('Registered message types in UnifiedMessageContent:', [registeredTypes], 'UnifiedMessageContent');

    // 如果没有注册的消息类型，记录错误
    if (registeredTypes.length === 0) {
      logger.error('No message types registered in registry. Messages cannot be displayed correctly.', undefined, 'UnifiedMessageContent');
    }
  }, [registry]);

  // 安全地转换消息
  let displayMessage: DisplayMessage;
  try {
    // 检查消息类型，如果是 ChatMessage，则转换为 DisplayMessage
    displayMessage = 'thread_id' in message
      ? toDisplayMessage(message as ChatMessage)
      : message as DisplayMessage;
  } catch (error) {
    console.error('Error converting message to DisplayMessage:', error);
    // 创建一个基本的显示消息作为回退
    displayMessage = {
      id: 'thread_id' in message ? message.id : 'error-message',
      content: `消息转换错误: ${error instanceof Error ? error.message : '未知错误'}`,
      role: 'thread_id' in message ? message.role : 'system',
      created_at: 'thread_id' in message ? message.created_at : new Date().toISOString(),
      user_id: 'thread_id' in message ? message.user_id : '',
    };
  }

  // 使用智能日志系统，避免重复日志
  logger.info('Rendering message:', [{
    id: displayMessage.id,
    role: displayMessage.role,
    contentType: typeof displayMessage.content === 'object' ?
      (displayMessage.content.type || 'object without type') :
      typeof displayMessage.content
  }], 'UnifiedMessageContent');

  // 这里不应该进行数据转换，而只是渲染
  // 数据转换应该在 toDisplayMessage 函数中完成
  // 这里只是为了调试，打印一些信息
  if (typeof displayMessage.content === 'object') {
    // 检查对象是否有type字段
    if ('type' in displayMessage.content) {
      // 使用智能日志系统，避免重复日志
      logger.info(`Message has type field: ${displayMessage.content.type}`, undefined, 'UnifiedMessageContent');

      // 检查是否是已注册的类型
      const registeredTypes = registry.getRegisteredTypes();
      logger.debug('Registered types for message:', [registeredTypes], 'UnifiedMessageContent');
      logger.debug(`Is type registered: ${registeredTypes.includes(displayMessage.content.type)}`, undefined, 'UnifiedMessageContent');
    } else {
      logger.warn('Message content is an object but has no type field!', undefined, 'UnifiedMessageContent');
    }
  }

  // 使用 registry 渲染消息内容
  // 使用智能日志系统，避免重复日志
  logger.debug('Before rendering, content type:', [typeof displayMessage.content], 'UnifiedMessageContent');
  if (typeof displayMessage.content === 'object' && displayMessage.content !== null && 'type' in displayMessage.content) {
    logger.debug('Content type field:', [displayMessage.content.type], 'UnifiedMessageContent');
  }

  // 使用 useMemo 缓存渲染结果，只有当消息内容或 registry 变化时才重新计算
  const renderResult = useMemo(() => {
    try {
      const result = registry.render(displayMessage.content, displayMessage);

      // 使用智能日志系统，避免重复日志
      logger.debug('Render result example:', [
        result && typeof result === 'object' && '__isDefaultText' in result
          ? { __isDefaultText: true }
          : { type: 'React component' }
      ], 'UnifiedMessageContent');

      return result;
    } catch (error) {
      logger.error('Error rendering message content:', [error], 'UnifiedMessageContent');
      // 创建一个错误消息作为回退
      return {
        __isDefaultText: true,
        content: `渲染错误: ${error instanceof Error ? error.message : '未知错误'}\n原始内容: ${
          typeof displayMessage.content === 'string'
            ? displayMessage.content
            : JSON.stringify(displayMessage.content, null, 2)
        }`
      } as DefaultTextMark;
    }
  }, [displayMessage, registry]);

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
});

export default UnifiedMessageContent;
