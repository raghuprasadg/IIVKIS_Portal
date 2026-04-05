import { NextResponse } from 'next/server';

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function buildApiCandidates(): string[] {
  const configured = [
    process.env['API_URL'],
    process.env['NEXT_PUBLIC_API_URL'],
  ].filter((v): v is string => Boolean(v && v.trim()));

  const expanded: string[] = [];
  for (const raw of configured) {
    const trimmed = raw.trim();
    expanded.push(trimmed);

    if (trimmed.includes('localhost') || trimmed.includes('127.0.0.1')) {
      expanded.push(trimmed.replace('localhost', 'api').replace('127.0.0.1', 'api'));
    }
  }

  expanded.push('http://api:4000');
  expanded.push('http://127.0.0.1:4000');

  return [...new Set(expanded.map(normalizeBaseUrl))];
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<{ status: number; body: T | null }> {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => null)) as T | null;
  return { status: response.status, body };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const tenantId = request.headers.get('x-dev-tenant-id') ?? process.env['PORTAL_TENANT_ID'] ?? 'tenant-uat';
  const userId = request.headers.get('x-dev-user-id') ?? process.env['PORTAL_USER_ID'] ?? 'portal-user';
  const candidates = buildApiCandidates();
  const errors: string[] = [];

  for (const baseUrl of candidates) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Trace-Id': crypto.randomUUID(),
      'X-Dev-Tenant-Id': tenantId,
      'X-Dev-User-Id': userId,
    };

    try {
      const incidentResp = await fetchJson<{ data?: Record<string, unknown>; error?: { message?: string } }>(
        `${baseUrl}/api/v1/incidents/${id}`,
        {
          headers,
          signal: AbortSignal.timeout(10000),
        },
      );

      if (incidentResp.status === 404) {
        errors.push(`${baseUrl} -> incident not found`);
        continue;
      }

      if (incidentResp.status >= 400 || !incidentResp.body?.data) {
        errors.push(
          `${baseUrl} -> incident request failed (${incidentResp.status}): ${incidentResp.body?.error?.message ?? 'unknown'}`,
        );
        continue;
      }

      const groupLinkResp = await fetchJson<{ data?: Array<Record<string, unknown>> }>(
        `${baseUrl}/api/v1/incidents/${id}/correlation-group`,
        {
          headers,
          signal: AbortSignal.timeout(10000),
        },
      );

      const linkedGroup = Array.isArray(groupLinkResp.body?.data)
        ? groupLinkResp.body?.data[0] ?? null
        : null;

      let groupDetail: Record<string, unknown> | null = null;
      if (linkedGroup?.['id']) {
        const groupResp = await fetchJson<{ data?: Record<string, unknown> }>(
          `${baseUrl}/api/v1/correlation/groups/${linkedGroup['id']}`,
          {
            headers,
            signal: AbortSignal.timeout(10000),
          },
        );

        groupDetail = groupResp.status < 400 ? groupResp.body?.data ?? null : linkedGroup;
      }

      return NextResponse.json({
        data: {
          incident: incidentResp.body.data,
          correlationGroup: groupDetail ?? linkedGroup,
          source: baseUrl,
        },
      });
    } catch (error) {
      errors.push(`${baseUrl} -> ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return NextResponse.json(
    {
      error: {
        message: `Could not load incident deep dive for ${id}. ${errors.at(-1) ?? 'No API candidate succeeded.'}`,
      },
    },
    { status: 404 },
  );
}