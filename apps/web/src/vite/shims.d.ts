declare module '../../notifyServer.mjs' {
  export function noticesConfigured(): boolean;
  export function placeNotices(input: { calls?: unknown; sms?: unknown }): Promise<{
    configured: boolean;
    callsPlaced: number;
    smsSent: number;
  }>;
  export function handleVoice(phone: string): string;
  export function phoneFromCallback(query: Record<string, string>, raw: string): string;
}

declare module '../../signPlanServer.mjs' {
  export const FALLBACK_ORDER: string[];
  export function filterAllowlisted(ids: unknown): string[];
  export function planSignOrder(input: {
    apiKey: string;
    baseUrl: string;
    model: string;
    prompt?: string;
    chapterId?: string;
    maxClips?: number;
  }): Promise<{
    order: string[];
    source?: string;
    label?: string;
    error?: string;
  }>;
}
