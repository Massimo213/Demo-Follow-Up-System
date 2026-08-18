import { NextRequest, NextResponse } from 'next/server';
import { isOrganizerRequest } from '@/lib/organizer-auth';
import { runPhase0AdversarialChecks } from '@/lib/phase0-adversarial';
import { runPhase0DbChecks } from '@/lib/phase0-db-checks';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!(await isOrganizerRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const unitChecks = runPhase0AdversarialChecks();
  const dbChecks = await runPhase0DbChecks();
  const checks = [...unitChecks, ...dbChecks];
  const failed = checks.filter((c) => !c.pass);
  return NextResponse.json({
    ok: failed.length === 0,
    passed: checks.length - failed.length,
    failed: failed.length,
    checks,
  });
}
