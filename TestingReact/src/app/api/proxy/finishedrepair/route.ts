import { NextRequest, NextResponse } from 'next/server';
import { broadcast } from '@/services/eventBus';

const BASE = process.env.NEXT_PUBLIC_TECHNICAL_API_URL || 'https://technicalservicesapi.camprotec.com.kh';
const VER  = process.env.NEXT_PUBLIC_API_VERSION        || '1.0';

function forwardHeaders(req: NextRequest): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const auth = req.headers.get('authorization');
  if (auth) h['Authorization'] = auth;
  return h;
}

/** POST /api/proxy/finishedrepair  → Marks a service ticket as finished/verified */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const res  = await fetch(`${BASE}/api/finishedrepair?api-version=${VER}`, {
      method: 'POST', headers: forwardHeaders(req), body, cache: 'no-store',
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
  }
}
