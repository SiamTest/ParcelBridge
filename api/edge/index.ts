/** Public entry point: the private API has no public workers.dev route. */
export interface EdgeEnv { PRIVATE_API: Fetcher }

export default {
  async fetch(request: Request, env: EdgeEnv): Promise<Response> {
    const url = new URL(request.url);
    if (!['/health', '/v1/'].some(prefix => url.pathname === prefix || url.pathname.startsWith(prefix)) &&
        !url.pathname.startsWith('/track/')) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    // Preserve the public entry URL so generated tracking links never reveal
    // the backend service name. Service bindings never expose the internal host.
    const response = await env.PRIVATE_API.fetch(request);
    const headers = new Headers(response.headers);
    headers.delete('server');
    headers.delete('x-powered-by');
    // Never reflect a private backend redirect into clients.
    const location = headers.get('location');
    if (location && !location.startsWith('/') && new URL(location, url).origin !== url.origin) {
      return Response.json({ error: 'Unavailable redirect' }, { status: 502 });
    }
    headers.set('Cache-Control', 'no-store');
    return new Response(response.body, { status: response.status, headers });
  },
};
