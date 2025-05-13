import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { IErrorReporter, getErrorReporter, ErrorReport } from '../services/error/ErrorReporter';

/**
 * 错误报告上下文接口
 */
interface ErrorReportContextType {
  /**
   * 错误报告服务实例
   */
  errorReporter: IErrorReporter;
  
  /**
   * 当前错误列表
   */
  errors: ErrorReport[];
  
  /**
   * 清除所有错误
   */
  clearErrors: () => void;
}

// 创建错误报告上下文
const ErrorReportContext = createContext<ErrorReportContextType | undefined>(undefined);

/**
 * 错误报告提供者属性
 */
interface ErrorReportProviderProps {
  children: ReactNode;
}

/**
 * 错误报告提供者组件
 * 提供错误报告服务和错误状态
 */
export const ErrorReportProvider: React.FC<ErrorReportProviderProps> = ({ children }) => {
  const [errors, setErrors] = useState<ErrorReport[]>([]);
  const errorReporter = getErrorReporter();

  useEffect(() => {
    // 添加错误报告监听器
    const removeListener = errorReporter.addListener((report) => {
      setErrors(prev => {
        // 检查是否已存在相同ID的错误
        if (prev.some(err => err.id === report.id)) {
          return prev;
        }
        return [report, ...prev];
      });
    });

    // 初始加载未显示的错误
    const unDisplayedErrors = errorReporter.getUnDisplayedReports();
    if (unDisplayedErrors.length > 0) {
      setErrors(unDisplayedErrors);
    }

    // 清理函数
    return () => {
      removeListener();
    };
  }, [errorReporter]);

  /**
   * 清除所有错误
   */
  const clearErrors = () => {
    errorReporter.clearReports();
    setErrors([]);
  };

  const value = {
    errorReporter,
    errors,
    clearErrors
  };

  return (
    <ErrorReportContext.Provider value={value}>
      {children}
    </ErrorReportContext.Provider>
  );
};

/**
 * 使用错误报告上下文的钩子
 * @returns 错误报告上下文
 * @throws Error 如果在 ErrorReportProvider 外部使用
 */
export const useErrorReport = (): ErrorReportContextType => {
  const context = useContext(ErrorReportContext);
  if (context === undefined) {
    throw new Error('useErrorReport must be used within an ErrorReportProvider');
  }
  return context;
};
