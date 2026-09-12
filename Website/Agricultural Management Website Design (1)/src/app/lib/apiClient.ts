/**
 * Client for the Coffee Cherry Maturity Detection API (backend/app.py).
 *
 * The backend requires an API key on every request except /health. Set
 * VITE_BACKEND_API_KEY in your .env to the raw key printed by
 * `python backend/generate_api_key.py` -- the server never stores that raw
 * key, only its SHA-256 hash (backend/api_key.hash), and compares the two
 * hashes on every call.
 */

const BACKEND_URL = (import.meta.env.VITE_BACKEND_API_URL as string) || 'http://localhost:8000';
const API_KEY = (import.meta.env.VITE_BACKEND_API_KEY as string) || '';

function authHeaders(extra: HeadersInit = {}): HeadersInit {
  if (!API_KEY && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(
      '[apiClient] VITE_BACKEND_API_KEY is not set -- requests to the backend will be rejected with 401.'
    );
  }
  return {
    ...extra,
    'X-API-Key': API_KEY,
  };
}

export interface BackendHealth {
  status: string;
  service: string;
  timestamp: number;
}

/** GET /health -- no API key required. Useful for a "backend reachable?" check. */
export async function checkBackendHealth(): Promise<BackendHealth> {
  const res = await fetch(`${BACKEND_URL}/health`);
  if (!res.ok) {
    throw new Error(`Backend health check failed: ${res.status}`);
  }
  return res.json();
}

export interface BackendDetection {
  box: [number, number, number, number];
  class: string;
  confidence: number;
  uncertain: boolean;
}

export interface BackendPredictResponse {
  timestamp: number;
  image_size: { width: number; height: number };
  total_count: number;
  class_counts: Record<string, number>;
  ripe_percentage: number;
  harvest_status: string;
  operational_thresholds: Record<string, number>;
  detections: BackendDetection[];
}

/** POST /predict -- sends a branch image to the backend for real detection. Requires the API key. */
export async function predictViaBackend(imageFile: File | Blob): Promise<BackendPredictResponse> {
  const formData = new FormData();
  formData.append('file', imageFile);

  const res = await fetch(`${BACKEND_URL}/predict`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

  if (res.status === 401) {
    throw new Error('Backend rejected the API key. Check VITE_BACKEND_API_KEY in your .env.');
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Backend prediction failed: ${res.status} ${detail}`);
  }

  return res.json();
}

export interface BoundingBoxCorrection {
  box: [number, number, number, number];
  original_class: string;
  corrected_class: string;
  confidence: number;
}

/** POST /correct -- records a manual correction as candidate future training data. Requires the API key. */
export async function submitCorrection(
  corrections: BoundingBoxCorrection[],
  options: { imageId?: string; userNotes?: string } = {}
): Promise<{ status: string; message: string; correction_id: string }> {
  const res = await fetch(`${BACKEND_URL}/correct`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      image_id: options.imageId,
      corrections,
      user_notes: options.userNotes,
    }),
  });

  if (res.status === 401) {
    throw new Error('Backend rejected the API key. Check VITE_BACKEND_API_KEY in your .env.');
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Backend correction failed: ${res.status} ${detail}`);
  }

  return res.json();
}

export interface BackendResetPasswordResponse {
  status: string;
  uid: string;
  email: string;
  temp_password: string;
}

/**
 * POST /admin/reset-worker-password -- called after the admin approves a
 * pending password_reset_requests entry. The backend holds privileged
 * Firebase Admin credentials (never exposed to the browser) and sets a
 * brand-new temporary password directly on the worker's account -- no real
 * email address is needed, so this works even for the auto-generated
 * @acojidofarm.local placeholder accounts. The worker is then forced
 * through the existing "change your password" screen the next time they
 * log in with the temp password. Requires the API key, and requires the
 * backend to have a Firebase service account key configured (see
 * backend/.env.example).
 */
export async function adminResetWorkerPassword(email: string): Promise<BackendResetPasswordResponse> {
  const res = await fetch(`${BACKEND_URL}/admin/reset-worker-password`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email }),
  });

  if (res.status === 401) {
    throw new Error('Backend rejected the API key. Check VITE_BACKEND_API_KEY in your .env.');
  }
  if (res.status === 503) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `The backend isn't set up to reset passwords yet (missing Firebase Admin credentials). ${detail}`
    );
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Password reset failed: ${res.status} ${detail}`);
  }

  return res.json();
}
