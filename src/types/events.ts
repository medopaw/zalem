import { Thread } from './threads';

/**
 * 线程更新事件的详细信息
 */
export interface ThreadUpdatedEventDetail {
  threads: Thread[];
}

declare global {
  interface WindowEventMap {
    'thread-updated': CustomEvent<ThreadUpdatedEventDetail>;
  }
}
