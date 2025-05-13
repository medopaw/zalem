/**
 * 消息系统模块导出
 *
 * 这个文件导出消息系统的所有组件，包括事件总线、消息服务和工具调用处理器
 */

// 事件总线
export { MessageEventBus, getMessageEventBus } from './MessageEventBus';
export { EventBusProvider, getEventBusProvider, setEventBusProvider } from './EventBusProvider';

// 消息服务
export { MessageService, createMessageService } from './MessageService';

// 消息发送器
export { MessageSender, createMessageSender } from './MessageSender';

// 工具调用处理器
export {
  ToolCallProcessorRegistry,
  getToolCallProcessorRegistry,
  setToolCallProcessorRegistry
} from './ToolCallProcessorRegistry';

// 类型导出
export type { IEventBusProvider } from './EventBusProvider';
export type { IToolCallProcessorRegistry } from './ToolCallProcessorRegistry';
