/**
 * 线程相关类型定义
 */

/**
 * 表示聊天线程的基本信息
 */
export interface Thread {
  /** 线程的唯一标识符 */
  id: string;
  /** 线程标题，可能为 null */
  title: string | null;
  /** 线程最后更新时间 */
  updated_at: string;
}
