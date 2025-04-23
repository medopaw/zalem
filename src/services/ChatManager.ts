/**
 * 兼容层 - 为了保持向后兼容性
 *
 * 这个文件将在未来版本中移除，请直接使用 chat/ChatManager
 * @deprecated 请使用 src/services/chat/ChatManager.ts
 */

import { ChatManager } from './chat/ChatManager';

// 重新导出 ChatManager，保持向后兼容
export { ChatManager };
