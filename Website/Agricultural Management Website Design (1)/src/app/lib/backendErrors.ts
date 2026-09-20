/**
 * The backend answers 401 for three different reasons, and only one of them is fixed by signing out and back
 * in. These messages say which one it really is, from the `detail` text the backend sends
 * (see verify_api_key / verify_admin_identity in backend/app.py).
 */
export const MISSING_API_KEY_MESSAGE =
  "The website has no backend API key. Add VITE_BACKEND_API_KEY to the website's .env file (the key comes from backend/generate_api_key.py), then restart the website.";

export const WRONG_API_KEY_MESSAGE =
  "The backend refused the website's API key: VITE_BACKEND_API_KEY doesn't match the backend's key (backend/api_key.hash). Generate a new key with backend/generate_api_key.py, put it in the website's .env, and restart the backend and the website.";

export const ADMIN_SESSION_MESSAGE = 'The backend rejected your admin sign-in. Sign out and back in, then try again.';

/** Turns the backend's 401 `detail` into the message that actually points at the problem. */
export function explainBackend401(detail: string): string {
  const d = detail.toLowerCase();
  if (d.includes('missing x-api-key')) return MISSING_API_KEY_MESSAGE;
  if (d.includes('invalid api key')) return WRONG_API_KEY_MESSAGE;
  return ADMIN_SESSION_MESSAGE;
}
