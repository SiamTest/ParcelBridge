import assert from 'node:assert/strict';
import { test } from 'node:test';
import edge, { type EdgeEnv } from '../edge/index';

function fixture(response: Response) {
  let invoked = false;
  let targetUrl = '';
  const env = {
    PRIVATE_API: {
      async fetch(request: Request) {
        invoked = true;
        targetUrl = request.url;
        return response;
      },
    },
  } as unknown as EdgeEnv;
  return { env, called: () => invoked, target: () => targetUrl };
}

test('public entry forwards API calls with original public hostname', async () => {
  const service = fixture(Response.json({ ok: true }));
  const request = new Request('https://public.example.org/v1/orders', { headers: { Authorization: 'Bearer example' } });
  const result = await edge.fetch(request, service.env);
  assert.equal(result.status, 200);
  assert.equal(service.target(), request.url);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.equal(service.called(), true);
});

test('public entry rejects unknown routes before calling the backend', async () => {
  const service = fixture(new Response('no'));
  const result = await edge.fetch(new Request('https://public.example.org/internal'), service.env);
  assert.equal(result.status, 404);
  assert.equal(service.called(), false);
});

test('public entry prevents forwarding cross-origin private backend redirects', async () => {
  const service = fixture(new Response(null, { status: 302, headers: { Location: 'https://private.example.org/secret' } }));
  const result = await edge.fetch(new Request('https://public.example.org/v1/orders'), service.env);
  assert.equal(result.status, 502);
  assert.equal(result.headers.get('location'), null);
});
