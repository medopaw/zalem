export interface ThreadUpdatedEventDetail {
  threads: Array<{
    id: string;
    title: string;
    updated_at: string;
  }>;
}

declare global {
  interface WindowEventMap {
    'thread-updated': CustomEvent<ThreadUpdatedEventDetail>;
  }
}