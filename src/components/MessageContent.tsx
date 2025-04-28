import { useState } from 'react';
import {
  DisplayMessage,
  ToolCallContent,
  ToolResultContent,
  DataRequestContent,
  DataResponseContent,
  MessageContent as MessageContentType
} from '../types/messageStructures';

interface MessageContentProps {
  message: DisplayMessage;
}

function MessageContent({ message }: MessageContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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
          {content.name === 'setNickname' && (
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

  // 渲染工具调用结果
  const renderToolResult = (content: ToolResultContent) => {
    const isSuccess = content.status === 'success';
    return (
      <div className="flex flex-col">
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className={`inline-flex items-center gap-2 px-2.5 py-1 ${
            isSuccess
              ? 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600'
              : 'bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600'
          } text-white rounded cursor-pointer transition-all text-xs font-medium shadow-sm`}
        >
          <span>{isSuccess ? '执行成功' : '执行失败'}</span>
        </div>
        {isExpanded && (
          <div className={`mt-1 p-2 rounded text-xs font-mono ${
            isSuccess ? 'bg-teal-50 text-teal-700' : 'bg-rose-50 text-rose-700'
          }`}>
            {content.message}
          </div>
        )}
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

  // 根据内容类型渲染不同的组件
  const renderContent = (content: MessageContentType): JSX.Element | null => {
    // 如果是字符串，直接渲染文本
    if (typeof content === 'string') {
      return renderTextContent(content);
    }

    // 根据内容类型渲染不同的组件
    switch (content.type) {
      case 'data_request':
        return renderDataRequest(content as DataRequestContent);
      case 'data_response':
        return renderDataResponse(content as DataResponseContent);
      case 'tool_call':
        return renderToolCall(content as ToolCallContent);
      case 'tool_result':
        return renderToolResult(content as ToolResultContent);
      default:
        return null;
    }
  };

  // 渲染消息内容
  return renderContent(message.content) || renderTextContent(String(message.content));
}

export default MessageContent;
