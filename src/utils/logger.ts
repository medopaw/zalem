/**
 * 智能日志系统
 * 
 * 这个模块提供了一个智能的日志系统，可以避免在React严格模式下产生重复的日志输出。
 * 它使用一个简单的缓存机制来跟踪已经输出过的日志，避免重复输出。
 */

// 日志级别
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

// 日志缓存，用于跟踪已经输出过的日志
// 使用Map来存储日志和它们最后一次输出的时间
const logCache = new Map<string, number>();

// 日志去重的时间窗口（毫秒）
// 在这个时间窗口内，相同的日志只会输出一次
const DEDUPLICATION_WINDOW = 500; // 500毫秒

/**
 * 智能日志函数
 * 
 * 这个函数会检查相同的日志是否在短时间内已经输出过，如果是，则不再重复输出。
 * 
 * @param level 日志级别
 * @param message 日志消息
 * @param args 额外的参数
 * @param context 日志上下文，用于区分不同来源的相同消息
 * @returns 是否实际输出了日志
 */
export function log(
  level: LogLevel,
  message: string,
  args?: any[],
  context?: string
): boolean {
  // 在生产环境中，只输出警告和错误
  if (process.env.NODE_ENV === 'production' && 
      level !== LogLevel.WARN && 
      level !== LogLevel.ERROR) {
    return false;
  }

  // 创建日志缓存的键
  // 使用消息、参数和上下文来唯一标识一条日志
  const cacheKey = `${context || ''}:${level}:${message}:${args ? JSON.stringify(args) : ''}`;
  
  // 获取当前时间
  const now = Date.now();
  
  // 检查是否在去重时间窗口内已经输出过相同的日志
  const lastLogTime = logCache.get(cacheKey);
  if (lastLogTime && now - lastLogTime < DEDUPLICATION_WINDOW) {
    // 如果在去重时间窗口内已经输出过，则不再重复输出
    return false;
  }
  
  // 更新日志缓存
  logCache.set(cacheKey, now);
  
  // 根据日志级别选择合适的控制台方法
  switch (level) {
    case LogLevel.DEBUG:
      args ? console.debug(message, ...args) : console.debug(message);
      break;
    case LogLevel.INFO:
      args ? console.log(message, ...args) : console.log(message);
      break;
    case LogLevel.WARN:
      args ? console.warn(message, ...args) : console.warn(message);
      break;
    case LogLevel.ERROR:
      args ? console.error(message, ...args) : console.error(message);
      break;
  }
  
  return true;
}

/**
 * 调试日志
 * 
 * @param message 日志消息
 * @param args 额外的参数
 * @param context 日志上下文
 * @returns 是否实际输出了日志
 */
export function debug(message: string, args?: any[], context?: string): boolean {
  return log(LogLevel.DEBUG, message, args, context);
}

/**
 * 信息日志
 * 
 * @param message 日志消息
 * @param args 额外的参数
 * @param context 日志上下文
 * @returns 是否实际输出了日志
 */
export function info(message: string, args?: any[], context?: string): boolean {
  return log(LogLevel.INFO, message, args, context);
}

/**
 * 警告日志
 * 
 * @param message 日志消息
 * @param args 额外的参数
 * @param context 日志上下文
 * @returns 是否实际输出了日志
 */
export function warn(message: string, args?: any[], context?: string): boolean {
  return log(LogLevel.WARN, message, args, context);
}

/**
 * 错误日志
 * 
 * @param message 日志消息
 * @param args 额外的参数
 * @param context 日志上下文
 * @returns 是否实际输出了日志
 */
export function error(message: string, args?: any[], context?: string): boolean {
  return log(LogLevel.ERROR, message, args, context);
}

/**
 * 清除日志缓存
 * 可以在需要重新开始记录日志时调用
 */
export function clearLogCache(): void {
  logCache.clear();
}

// 默认导出所有日志函数
export default {
  debug,
  info,
  warn,
  error,
  clearLogCache
};
