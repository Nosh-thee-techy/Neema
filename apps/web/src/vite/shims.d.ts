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
