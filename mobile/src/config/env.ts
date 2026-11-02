/** Public runtime configuration (EXPO_PUBLIC_* values are inlined at build time). */
export const API_URL: string = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
