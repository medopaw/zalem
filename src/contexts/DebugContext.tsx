import React, { createContext, useContext, useState, ReactNode } from 'react';

// 调试模式上下文接口
interface DebugContextType {
  isDebugMode: boolean;
  toggleDebugMode: () => void;
}

// 创建上下文
const DebugContext = createContext<DebugContextType | undefined>(undefined);

// 调试模式提供者属性
interface DebugProviderProps {
  children: ReactNode;
}

/**
 * 调试模式提供者组件
 * 提供调试模式状态和切换功能
 */
export function DebugProvider({ children }: DebugProviderProps) {
  // 调试模式状态，默认关闭
  const [isDebugMode, setIsDebugMode] = useState(false);

  // 切换调试模式
  const toggleDebugMode = () => {
    setIsDebugMode(prev => !prev);
  };

  // 上下文值
  const value = {
    isDebugMode,
    toggleDebugMode
  };

  return (
    <DebugContext.Provider value={value}>
      {children}
    </DebugContext.Provider>
  );
}

/**
 * 使用调试模式钩子
 * 在组件中获取调试模式状态和切换功能
 */
export function useDebugMode() {
  const context = useContext(DebugContext);
  if (context === undefined) {
    throw new Error('useDebugMode must be used within a DebugProvider');
  }
  return context;
}
