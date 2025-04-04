import React, { useState } from 'react';
import { ChatMessage } from '../types/chat';

interface MultiPartMessage {
  type: 'multi_part';
  parts: Array<{
    type: string;
    [key: string]: any;
  }>;
}

interface MessageContentProps {
  message: ChatMessage;
}

function MessageContent({ message }: MessageContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const renderToolCall = (content: any) => {
    if (content?.type === 'data_request') {
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
    }

    if (content?.type === 'data_response') {
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
    }

    if (content?.type === 'tool_call') {
      return (
        <div className="flex flex-col">
          <div
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-2 px-2.5 py-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded cursor-pointer hover:from-blue-600 hover:to-cyan-600 transition-all text-xs font-medium shadow-sm"
          >              
            <span>执行功能: {content.name}</span>
            {content.name === 'setNickname' && (
              <span className="text-blue-100 text-xs">
                ({content.parameters.nickname})
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
    }

    if (content?.type === 'execution_result') {
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
    }

    return null;
  };

  try {
    const content = JSON.parse(message.content);

    // Handle multi-part messages
    if (content?.type === 'multi_part') {
      return (
        <div className="flex flex-col gap-2">
          {content.parts.map((part: any, index: number) => (
            <div key={index}>
              {renderToolCall(part)}
            </div>
          ))}
        </div>
      );
    }
    
    if (content?.type === 'tool_calls') {
      return (
        <div className="flex flex-col gap-2">
          {content.calls.map((call: any, index: number) => (
            <div key={index} className="flex flex-col">
              {renderToolCall(call)}
            </div>
          ))}
        </div>
      );
    }
    
    return renderToolCall(content) || (
      <div className={`rounded-lg p-4 ${
        message.role === 'user'
          ? 'bg-blue-600 text-white rounded-lg'
          : 'bg-gray-100 text-gray-900 rounded-r-lg'
      }`}>
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    );
  } catch (e) {
    return (
      <div className={`rounded-lg p-4 ${
        message.role === 'user'
          ? 'bg-blue-600 text-white rounded-lg'
          : 'bg-gray-100 text-gray-900 rounded-r-lg'
      }`}>
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    );
  }
}

export default MessageContent;