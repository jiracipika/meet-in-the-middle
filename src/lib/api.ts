/**
 * The packaged apps ship the UI as static files, so there is no Next server on
 * device: API calls go to the deployed site instead. The base URL is baked in
 * at mobile-export build time via NEXT_PUBLIC_API_BASE (see
 * mobile/scripts/export-web.mjs); on the web it stays empty and paths stay
 * relative, exactly as before.
 */
export function apiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_BASE ?? "";
  return `${base}${path}`;
}
