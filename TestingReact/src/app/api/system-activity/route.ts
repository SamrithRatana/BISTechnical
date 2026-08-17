/**
 * @file api/system-activity/route.ts
 * @description "Is anyone using this right now?" — the check to run before a
 * deploy or a maintenance restart.
 *
 * Separate from `/api/health` on purpose. Health is polled by every browser
 * every 30 seconds and answers "can I work?"; this answers "can I take the
 * system away?", is read by whoever is deploying, and carries numbers
 * (connected sessions, what was last written) that ordinary users have no
 * reason to see.
 *
 * Also usable from a script, which is the point — this is the check a deploy
 * pipeline should make before restarting anything:
 *
 *   curl -s http://<host>/api/system-activity | jq -e '.safeToDeploy'
 *
 * It exits non-zero while anyone is connected or a write is in flight.
 */

import { NextResponse } from "next/server";
import { getActivity } from "@/services/activityTracker";

/** Never cache — a cached "safe to deploy" is exactly the wrong answer. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const activity = getActivity();

  return NextResponse.json(
    {
      ...activity,
      /**
       * Stated in the payload rather than left to the reader's memory: these
       * counts come from one Node process's memory. Behind a load balancer,
       * `safeToDeploy: true` means "safe on the instance that answered", not
       * "safe everywhere" — the same single-process limit `eventBus` carries.
       */
      scope: "single-instance",
    },
    {
      // 200 either way: the *question* was answered successfully. Read
      // `safeToDeploy`, not the status code.
      status: 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
