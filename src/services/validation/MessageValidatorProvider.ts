/**
 * 消息验证器提供者
 *
 * 提供获取消息验证器实例的方法
 */

import { MessageValidator, IMessageValidator } from './MessageValidator';
import { getErrorReporter } from '../error/ErrorReporter';

// 单例实例
let messageValidator: IMessageValidator | null = null;

/**
 * 获取消息验证器实例
 * @returns 消息验证器实例
 */
export function getMessageValidator(): IMessageValidator {
  if (!messageValidator) {
    // 创建新实例
    const errorReporter = getErrorReporter();
    messageValidator = new MessageValidator(errorReporter);
  }

  return messageValidator;
}

/**
 * 重置消息验证器实例
 * 主要用于测试
 */
export function resetMessageValidator(): void {
  messageValidator = null;
}
