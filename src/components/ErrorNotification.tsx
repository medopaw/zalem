import React, { useEffect, useState } from 'react';
import { AlertCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { ErrorReport, ErrorLevel, getErrorReporter } from '../services/error/ErrorReporter';

/**
 * 错误通知组件
 * 显示全局错误通知
 */
const ErrorNotification: React.FC = () => {
  const [errors, setErrors] = useState<ErrorReport[]>([]);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    // 获取错误报告服务实例
    const errorReporter = getErrorReporter();

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
  }, []);

  // 关闭错误通知
  const handleClose = (id: string) => {
    setErrors(prev => prev.filter(err => err.id !== id));
    getErrorReporter().markAsDisplayed(id);
  };

  // 不再支持重试操作

  // 切换错误详情展开状态
  const toggleErrorDetails = (id: string) => {
    setExpandedErrors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // 获取错误级别对应的样式
  const getErrorStyles = (level: ErrorLevel) => {
    switch (level) {
      case ErrorLevel.INFO:
        return {
          container: 'bg-blue-50 border-blue-400',
          icon: 'text-blue-400',
          text: 'text-blue-700',
          button: 'bg-blue-100 hover:bg-blue-200 text-blue-700'
        };
      case ErrorLevel.WARNING:
        return {
          container: 'bg-yellow-50 border-yellow-400',
          icon: 'text-yellow-400',
          text: 'text-yellow-700',
          button: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700'
        };
      case ErrorLevel.CRITICAL:
        return {
          container: 'bg-red-100 border-red-500',
          icon: 'text-red-500',
          text: 'text-red-700',
          button: 'bg-red-200 hover:bg-red-300 text-red-700'
        };
      case ErrorLevel.ERROR:
      default:
        return {
          container: 'bg-red-50 border-red-400',
          icon: 'text-red-400',
          text: 'text-red-700',
          button: 'bg-red-100 hover:bg-red-200 text-red-700'
        };
    }
  };

  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {errors.map(error => {
        const styles = getErrorStyles(error.level);
        const isExpanded = expandedErrors.has(error.id);

        return (
          <div
            key={error.id}
            className={`${styles.container} border-l-4 p-4 rounded shadow-lg transition-all duration-300 ease-in-out`}
          >
            <div className="flex justify-between items-start">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className={`h-5 w-5 ${styles.icon}`} />
                </div>
                <div className="ml-3">
                  <h3 className={`text-sm font-medium ${styles.text}`}>{error.title}</h3>
                  <p className={`text-sm ${styles.text} mt-1`}>{error.message}</p>

                  {error.details && (
                    <div className="mt-2">
                      <button
                        onClick={() => toggleErrorDetails(error.id)}
                        className={`flex items-center text-xs ${styles.text} hover:underline`}
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-3 w-3 mr-1" />
                            隐藏详情
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3 mr-1" />
                            查看详情
                          </>
                        )}
                      </button>

                      {isExpanded && (
                        <pre className={`mt-2 p-2 ${styles.container} rounded text-xs font-mono overflow-x-auto max-h-40`}>
                          {error.details}
                        </pre>
                      )}
                    </div>
                  )}

                  {error.context && (
                    <p className={`text-xs ${styles.text} mt-1 opacity-75`}>
                      上下文: {error.context}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleClose(error.id)}
                  className="p-1 rounded-full hover:bg-gray-200"
                  aria-label="关闭"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ErrorNotification;
