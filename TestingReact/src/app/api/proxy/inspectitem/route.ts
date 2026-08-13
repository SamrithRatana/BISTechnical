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

/** POST /api/proxy/inspectitem  → Creates a new inspection record */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const res  = await fetch(`${BASE}/api/inspectitem?api-version=${VER}`, {
      method: 'POST', headers: forwardHeaders(req), body, cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) broadcastInspection();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 500 });
  }
}

/** PUT /api/proxy/inspectitem  → Updates an existing inspection record */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.text();
    const res  = await fetch(`${BASE}/api/inspectitem?api-version=${VER}`, {
      method: 'PUT', headers: forwardHeaders(req), body, cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) broadcastInspection();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 500 });
  }
}
