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

/** POST /api/proxy/finishedrepair  → Marks a service ticket as finished/verified */
export async function POST(req: NextRequest) {
  // Counted as a write: this route bypasses the generic `[...path]` proxy, so
  // final QA verification — the last step before a ticket is closed — was
  // invisible to the deploy-safety check.
  const endWrite = beginWrite('POST /finishedrepair');
  try {
    const body = await req.text();
    const res  = await fetch(`${BASE}/api/finishedrepair?api-version=${VER}`, {
      method: 'POST', headers: forwardHeaders(req), body, cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const data = await res.json().catch(() => ({}));

    // Verifying a repair moves the ticket into "Finished". This route bypasses
    // the generic proxy, so without broadcasting here the change was invisible
    // to every other user until their next poll.
    if (res.ok) {
      broadcast({
        type: 'status_changed',
        resource: 'ticket',
        status: 'Finished',
        at: new Date().toISOString(),
      });
    }

    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 500 });
  } finally {
    endWrite();
  }
}
