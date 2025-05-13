/**
 * 错误报告服务
 *
 * 负责收集和显示错误，提供统一的错误报告机制
 */

import logger from '../../utils/logger';

/**
 * 错误级别
 */
export enum ErrorLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * 错误报告数据
 */
export interface ErrorReport {
  /**
   * 错误标题
   */
  title: string;

  /**
   * 错误消息
   */
  message: string;

  /**
   * 错误级别
   */
  level: ErrorLevel;

  /**
   * 错误详情（可选）
   */
  details?: string;

  /**
   * 错误上下文（可选）
   */
  context?: string;

  /**
   * 操作类型（可选）
   */
  actionType?: string;

  /**
   * 时间戳
   */
  timestamp: number;

  /**
   * 错误ID
   */
  id: string;

  /**
   * 是否已显示给用户
   */
  displayed?: boolean;

  /**
   * 已移除重试功能
   * @deprecated
   */
  _deprecated?: never;
}

/**
 * 错误报告监听器
 */
export type ErrorReportListener = (report: ErrorReport) => void;

/**
 * 错误报告服务接口
 */
export interface IErrorReporter {
  /**
   * 报告错误
   */
  report(error: Error | string, options?: Partial<ErrorReport>): ErrorReport;

  /**
   * 向UI报告错误
   */
  reportToUI(options: Omit<ErrorReport, 'timestamp' | 'id' | 'displayed'>): ErrorReport;

  /**
   * 添加错误报告监听器
   */
  addListener(listener: ErrorReportListener): () => void;

  /**
   * 获取所有未显示的错误报告
   */
  getUnDisplayedReports(): ErrorReport[];

  /**
   * 标记错误报告为已显示
   */
  markAsDisplayed(id: string): void;

  /**
   * 清除所有错误报告
   */
  clearReports(): void;
}

/**
 * 错误报告服务实现
 */
export class ErrorReporter implements IErrorReporter {
  private reports: Map<string, ErrorReport> = new Map();
  private listeners: Set<ErrorReportListener> = new Set();

  /**
   * 报告错误
   * @param error 错误对象或错误消息
   * @param options 错误报告选项
   * @returns 错误报告
   */
  report(error: Error | string, options: Partial<ErrorReport> = {}): ErrorReport {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorDetails = error instanceof Error ? error.stack : undefined;

    const report: ErrorReport = {
      title: options.title || '操作失败',
      message: options.message || errorMessage,
      level: options.level || ErrorLevel.ERROR,
      details: options.details || errorDetails,
      context: options.context,
      actionType: options.actionType,
      timestamp: Date.now(),
      id: `error-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      displayed: false
    };

    // 记录错误日志
    this.logError(report);

    // 存储错误报告
    this.reports.set(report.id, report);

    // 通知监听器
    this.notifyListeners(report);

    return report;
  }

  /**
   * 向UI报告错误
   * @param options 错误报告选项
   * @returns 错误报告
   */
  reportToUI(options: Omit<ErrorReport, 'timestamp' | 'id' | 'displayed'>): ErrorReport {
    const report: ErrorReport = {
      ...options,
      timestamp: Date.now(),
      id: `error-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      displayed: false
    };

    // 记录错误日志
    this.logError(report);

    // 存储错误报告
    this.reports.set(report.id, report);

    // 通知监听器
    this.notifyListeners(report);

    return report;
  }

  /**
   * 添加错误报告监听器
   * @param listener 监听器函数
   * @returns 移除监听器的函数
   */
  addListener(listener: ErrorReportListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 获取所有未显示的错误报告
   * @returns 未显示的错误报告数组
   */
  getUnDisplayedReports(): ErrorReport[] {
    return Array.from(this.reports.values())
      .filter(report => !report.displayed)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 标记错误报告为已显示
   * @param id 错误报告ID
   */
  markAsDisplayed(id: string): void {
    const report = this.reports.get(id);
    if (report) {
      report.displayed = true;
      this.reports.set(id, report);
    }
  }

  /**
   * 清除所有错误报告
   */
  clearReports(): void {
    this.reports.clear();
  }

  /**
   * 记录错误日志
   * @param report 错误报告
   */
  private logError(report: ErrorReport): void {
    const logMessage = `[${report.level.toUpperCase()}] ${report.title}: ${report.message}`;
    const logContext = report.context ? `Context: ${report.context}` : '';
    const logDetails = report.details ? `Details: ${report.details}` : '';

    switch (report.level) {
      case ErrorLevel.INFO:
        logger.info(logMessage, [logContext, logDetails], 'ErrorReporter');
        break;
      case ErrorLevel.WARNING:
        logger.warn(logMessage, [logContext, logDetails], 'ErrorReporter');
        break;
      case ErrorLevel.ERROR:
      case ErrorLevel.CRITICAL:
        logger.error(logMessage, [logContext, logDetails], 'ErrorReporter');
        break;
    }
  }

  /**
   * 通知所有监听器
   * @param report 错误报告
   */
  private notifyListeners(report: ErrorReport): void {
    this.listeners.forEach(listener => {
      try {
        listener(report);
      } catch (error) {
        logger.error('Error in error report listener:', [error], 'ErrorReporter');
      }
    });
  }
}

// 创建单例实例
let instance: IErrorReporter | null = null;

/**
 * 获取错误报告服务实例
 * @returns 错误报告服务实例
 */
export function getErrorReporter(): IErrorReporter {
  if (!instance) {
    instance = new ErrorReporter();
  }
  return instance;
}

/**
 * 设置错误报告服务实例
 * 用于测试和依赖注入
 * @param reporter 错误报告服务实例
 */
export function setErrorReporter(reporter: IErrorReporter): void {
  instance = reporter;
}
