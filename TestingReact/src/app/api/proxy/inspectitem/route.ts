import { NextRequest, NextResponse } from 'next/server';
import { broadcast } from '@/services/eventBus';
import { beginWrite } from '@/services/activityTracker';

const BASE = process.env.NEXT_PUBLIC_TECHNICAL_API_URL || 'https://technicalservicesapi.camprotec.com.kh';
const VER  = process.env.NEXT_PUBLIC_API_VERSION        || '1.0';

/**
 * Same deadline the generic proxy uses. Without one, a backend that accepts
 * the connection and then stalls holds this handler open indefinitely.
 */
const UPSTREAM_TIMEOUT_MS = 30_000;

function forwardHeaders(req: NextRequest): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const auth = req.headers.get('authorization');
  if (auth) h['Authorization'] = auth;
  return h;
}

/**
 * Accepting an inspection moves the ticket out of "Inspecting" and into
 * "Inspection". This route bypasses the generic proxy, so without broadcasting
 * here the ticket lingered on every other user's Inspecting queue until their
 * next poll.
 */
function broadcastInspection(): void {
  broadcast({
    type: 'status_changed',
    resource: 'ticket',
    status: 'Inspection',
    at: new Date().toISOString(),
  });
}

/**
 * POST /api/proxy/inspectitem  → Creates a new inspection record
 *
 * Counted as a write: this route bypasses the generic `[...path]` proxy, so it
 * was invisible to the deploy-safety check — and saving an inspection is the
 * longest, most valuable piece of work anyone does in this app. Restarting
 * mid-save here loses a technician's whole diagnosis and spare-parts list.
 */
export async function POST(req: NextRequest) {
  const endWrite = beginWrite('POST /inspectitem');
  try {
    const body = await req.text();
    const res  = await fetch(`${BASE}/api/inspectitem?api-version=${VER}`, {
      method: 'POST', headers: forwardHeaders(req), body, cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) broadcastInspection();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 500 });
  } finally {
    endWrite();
  }
}

/** PUT /api/proxy/inspectitem  → Updates an existing inspection record */
export async function PUT(req: NextRequest) {
  const endWrite = beginWrite('PUT /inspectitem');
  try {
    const body = await req.text();
    const res  = await fetch(`${BASE}/api/inspectitem?api-version=${VER}`, {
      method: 'PUT', headers: forwardHeaders(req), body, cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) broadcastInspection();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 500 });
  } finally {
    endWrite();
  }
}
