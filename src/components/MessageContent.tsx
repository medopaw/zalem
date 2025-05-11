import { useState } from 'react';
import { DisplayMessage } from '../types/messageStructures';
import {
  MessageContent as MessageContentType,
  BaseMessageContent,
  ToolCallContent,
  ToolCallsContent,
  ToolResultContent,
  DataRequestContent,
  DataResponseContent,
  isTextMessageContent,
  isToolCallContent,
  isToolCallsContent,
  isToolResultContent,
  isDataRequestContent,
  isDataResponseContent
} from '../types/messageContentTypes';

interface MessageContentProps {
  message: DisplayMessage;
}

function MessageContent({ message }: MessageContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 调试日志，查看消息内容
  console.log('Rendering message:', {
    id: message.id,
    role: message.role,
    content: message.content,
    contentType: typeof message.content === 'object' ? message.content.type : 'string'
  });

  // 如果是对象，打印完整内容
  if (typeof message.content === 'object') {
    console.log('Message content details:', JSON.stringify(message.content, null, 2));
  }

  // 渲染数据请求
  const renderDataRequest = (content: DataRequestContent) => {
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
  };

  // 渲染数据响应
  const renderDataResponse = (content: DataResponseContent) => {
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
  };

  // 渲染工具调用
  const renderToolCall = (content: ToolCallContent) => {
    return (
      <div className="flex flex-col">
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center gap-2 px-2.5 py-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded cursor-pointer hover:from-blue-600 hover:to-cyan-600 transition-all text-xs font-medium shadow-sm"
        >
          <span>执行功能: {content.name}</span>
          {(content.name === 'setNickname' || content.name === 'set_nickname') && (
            <span className="text-blue-100 text-xs">
              ({String(content.parameters.nickname)})
            </span>
          )}
        </div>
        {isExpanded && (
          <div className="mt-1 p-2 bg-blue-50 rounded text-xs font-mono text-blue-700">
            {JSON.stringify(content.parameters, null, 2)}
          </div>
        )}
      </div>
    );
  };

  // 渲染工具调用结果 - 系统样式居中显示
  const renderToolResult = (content: ToolResultContent) => {
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
  };



  // 渲染纯文本消息
  const renderTextContent = (content: string) => {
    return (
      <div className={`rounded-lg p-4 ${
        message.role === 'user'
          ? 'bg-blue-600 text-white rounded-lg'
          : 'bg-gray-100 text-gray-900 rounded-r-lg'
      }`}>
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
    );
  };

  // 渲染多个工具调用
  const renderToolCalls = (content: ToolCallsContent) => {
    return (
      <div className="flex flex-col space-y-2">
        {content.calls.map((call) => (
          <div key={call.id} className="flex flex-col">
            <div
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-2 px-2.5 py-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded cursor-pointer hover:from-blue-600 hover:to-cyan-600 transition-all text-xs font-medium shadow-sm"
            >
              <span>执行功能: {call.name}</span>
              {(call.name === 'set_nickname' || call.name === 'setNickname') && (
                <span className="text-blue-100 text-xs">
                  ({String(call.parameters.nickname)})
                </span>
              )}
            </div>
            {isExpanded && (
              <div className="mt-1 p-2 bg-blue-50 rounded text-xs font-mono text-blue-700">
                {JSON.stringify(call.parameters, null, 2)}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // 根据内容类型渲染不同的组件
  const renderContent = (content: MessageContentType): JSX.Element | null => {
    // 如果是字符串，直接渲染文本
    if (typeof content === 'string') {
      return renderTextContent(content);
    }

    console.log('Rendering object content with type:', content.type);

    // 使用类型守卫函数进行类型检查
    if (isDataRequestContent(content)) {
      return renderDataRequest(content);
    } else if (isDataResponseContent(content)) {
      return renderDataResponse(content);
    } else if (isToolCallContent(content)) {
      console.log('Rendering tool call:', content);
      return renderToolCall(content);
    } else if (isToolCallsContent(content)) {
      console.log('Rendering tool calls:', content);
      return renderToolCalls(content);
    } else if (isToolResultContent(content)) {
      console.log('Rendering tool result:', content);
      return renderToolResult(content);
    } else if (isTextMessageContent(content)) {
      return renderTextContent(content.text);
    } else {
      console.warn('Unknown message content type:', content);
      // 尝试基于type字段进行渲染
      if (typeof content === 'object' && 'type' in content) {
        const contentWithType = content as BaseMessageContent;
        if (contentWithType.type === 'tool_call') {
          console.log('Fallback: Rendering as tool call');
          return renderToolCall(content as ToolCallContent);
        } else if (contentWithType.type === 'tool_result') {
          console.log('Fallback: Rendering as tool result');
          return renderToolResult(content as ToolResultContent);
        } else if (contentWithType.type === 'tool_calls') {
          console.log('Fallback: Rendering as tool calls');
          return renderToolCalls(content as ToolCallsContent);
        }
      }
      return null;
    }
  };

  // 渲染消息内容
  return renderContent(message.content) || renderTextContent(String(message.content));
}

export default MessageContent;
