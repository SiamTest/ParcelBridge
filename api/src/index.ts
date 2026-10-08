import { createClient, type Client, type InValue } from '@libsql/client/web';
import { digest, equal, passwordHash, randomCode, randomToken } from './crypto';
import { distanceKm, HttpError, numberField, passwordField, quote, requireThat, terminal, textField, transition, validManifest } from './domain';

export interface Env {
  TURSO_DATABASE_URL: string; TURSO_AUTH_TOKEN: string;
  [key: string]: string;
}
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const now = () => Math.floor(Date.now() / 1000);
const id = () => crypto.randomUUID();
type Row = Record<string, InValue>;
const publicUser = (u: Row) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, approved: u.approved, blocked: u.blocked, online: u.online });

export function createApp(db: Client, env: Env) {
  const sql = async (query: string, args: InValue[] = []) => {
    const result = await db.execute({ sql: query, args });
    // libSQL rows also have numeric properties; copy named columns to avoid leaking redacted values.
    return { ...result, rows: result.rows.map(row => Object.fromEntries(result.columns.map(name => [name, row[name]])) as Row) };
  };
  const one = async (query: string, args: InValue[] = []) => (await sql(query, args)).rows[0];
  async function limit(key: string, max: number, seconds: number) {
    const reset = now() + seconds;
    const result = await sql(`INSERT INTO rate_limits(key,count,reset_at) VALUES (?,1,?)
      ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE count+1 END,
      reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END RETURNING count`, [key, reset, now(), now()]);
    requireThat(Number(result.rows[0].count) <= max, 429, 'Too many attempts. Try again later.');
  }
  async function user(request: Request) {
    const bearer = request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    requireThat(bearer, 401, 'Sign in to continue');
    const u = await one(`SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?`, [await digest(bearer), now()]);
    requireThat(u && !u.blocked, 401, 'Session expired or account unavailable');
    return u;
  }
  async function body(request: Request): Promise<Record<string, unknown>> {
    requireThat(request.headers.get('Content-Type')?.includes('application/json'), 415, 'Send JSON');
    const reader = request.body?.getReader();
    requireThat(reader, 400, 'Missing JSON body');
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.length;
      if (size > 16384) { await reader.cancel(); throw new HttpError(413, 'Request too large'); }
      chunks.push(chunk.value);
    }
    const buffer = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
    let parsed: unknown;
    try { parsed = JSON.parse(new TextDecoder().decode(buffer)); } catch { throw new HttpError(400, 'Invalid JSON'); }
    requireThat(parsed && typeof parsed === 'object' && !Array.isArray(parsed), 400, 'Expected a JSON object');
    return parsed as Record<string, unknown>;
  }
  const role = (u: Row, expected: string) => requireThat(u.role === expected, 403, `${expected} account required`);
  async function orderFor(u: Row, orderId: string) {
    const o = await one('SELECT * FROM orders WHERE id=?', [orderId]);
    requireThat(o, 404, 'Delivery not found');
    requireThat(u.role === 'admin' || o.seller_id === u.id || o.rider_id === u.id, 403, 'This delivery belongs to another account');
    return o;
  }
  function visibleOrder(o: Row, u: Row) {
    const result = { ...o };
    delete result.tracking_token;
    if (o.seller_id !== u.id) { delete result.pickup_code; delete result.delivery_code; }
    return result;
  }
  async function audit(actor: Row, action: string, target: string) {
    await sql('INSERT INTO audit VALUES (?,?,?,?,?)', [id(), actor.id, action, target, now()]);
  }
  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url), path = url.pathname, method = request.method;
    if (path === '/health') return json({ ok: true, service: 'ParcelBridge', city: 'Feni' });
    if (path.startsWith('/track/')) return trackingPage(path.split('/').pop()!);
    requireThat(path.startsWith('/v1/'), 404, 'Not found');
    const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
    await limit(`api:${ip}`, 180, 60);
    if (path === '/v1/config' && method === 'GET') return json({ city: 'Feni', currency: env.CURRENCY ?? 'BDT', city_lat: Number(env.CITY_LAT ?? 23.0144), city_lng: Number(env.CITY_LNG ?? 91.3966), city_radius_km: Number(env.CITY_RADIUS_KM ?? 3), max_cod_minor: Number(env.MAX_COD_MINOR ?? 1000000), pricing_basis: 'straight_line_estimate', github_repository: env.GITHUB_REPOSITORY ?? '' });
    if (path === '/v1/updates' && method === 'GET') {
      requireThat(/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY ?? ''), 503, 'Release repository is not configured');
      const repo = env.GITHUB_REPOSITORY;
      const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { 'User-Agent': 'ParcelBridge', Accept: 'application/vnd.github+json' }, cf: { cacheTtl: 300, cacheEverything: true } });
      requireThat(response.ok, 503, 'No published release is available');
      const release = await response.json() as { assets: { name: string; browser_download_url: string }[] };
      const asset = release.assets.find(a => a.name === 'update.json');
      requireThat(asset && asset.browser_download_url.startsWith(`https://github.com/${repo}/releases/download/`), 502, 'Update manifest unavailable');
      const manifest = await fetch(asset.browser_download_url, { cf: { cacheTtl: 300, cacheEverything: true } });
      requireThat(manifest.ok, 502, 'Update manifest unavailable');
      return json(validManifest(await manifest.json() as Record<string, unknown>, repo));
    }
    if (path.startsWith('/v1/auth/') && method === 'POST') {
      const b = await body(request);
      if (path === '/v1/auth/logout') {
        await user(request);
        await sql('DELETE FROM sessions WHERE token_hash=?', [await digest(request.headers.get('Authorization')!.slice(7))]);
        return json({ ok: true });
      }
      requireThat(['/v1/auth/register', '/v1/auth/login'].includes(path), 404, 'Not found');
      const email = textField(b, 'email', 254).toLowerCase(), password = passwordField(b, 'password');
      requireThat(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && password.length >= 10, 400, 'Enter an email and a password with at least 10 characters');
      await limit(`auth-ip:${ip}`, 12, 900);
      await limit(`auth-email:${await digest(email)}`, 8, 900);
      let u = await one('SELECT * FROM users WHERE email=?', [email]);
      if (path.endsWith('/register')) {
        const requestedRole = textField(b, 'role');
        requireThat(['seller', 'rider'].includes(requestedRole), 400, 'Choose seller or rider');
        requireThat(!u, 409, 'Unable to register this email. Try signing in.');
        const phone = textField(b, 'phone', 20);
        requireThat(/^(?:\+?88)?01[3-9]\d{8}$/.test(phone), 400, 'Enter a Bangladesh mobile number');
        const uid = id(), salt = randomToken();
        await sql('INSERT INTO users(id,email,name,phone,password_hash,salt,role,approved,created_at) VALUES (?,?,?,?,?,?,?,?,?)', [uid, email, textField(b, 'name', 80), phone, await passwordHash(password, salt), salt, requestedRole, requestedRole === 'seller' ? 1 : 0, now()]);
        u = (await one('SELECT * FROM users WHERE id=?', [uid]))!;
      } else {
        const hash = await passwordHash(password, String(u?.salt ?? 'missing-user-dummy-salt'));
        requireThat(u && !u.blocked && equal(hash, String(u.password_hash)), 401, 'Email or password is incorrect');
      }
      const token = randomToken();
      await sql('INSERT INTO sessions VALUES (?,?,?)', [await digest(token), u.id, now() + 30 * 86400]);
      return json({ token, user: publicUser(u) }, path.endsWith('/register') ? 201 : 200);
    }
    const u = await user(request);
    if (path === '/v1/me' && method === 'GET') return json(publicUser(u));
    if (path === '/v1/me/password' && method === 'POST') {
      const b = await body(request), old = passwordField(b, 'current_password'), next = passwordField(b, 'new_password');
      await limit(`password:${u.id}`, 5, 900);
      requireThat(next.length >= 10 && equal(await passwordHash(old, String(u.salt)), String(u.password_hash)), 400, 'Current password is incorrect or new password is too short');
      const salt = randomToken();
      await db.batch([{ sql: 'UPDATE users SET salt=?,password_hash=? WHERE id=?', args: [salt, await passwordHash(next, salt), u.id] }, { sql: 'DELETE FROM sessions WHERE user_id=?', args: [u.id] }], 'write');
      return json({ ok: true, sign_in_again: true });
    }
    if (path === '/v1/me/availability' && method === 'POST') {
      role(u, 'rider'); requireThat(u.approved, 403, 'Rider approval is pending');
      const b = await body(request), online = numberField(b, 'online', 0, 1, true);
      const lat = numberField(b, 'lat', -90, 90), lng = numberField(b, 'lng', -180, 180);
      await sql('UPDATE users SET online=?,lat=?,lng=?,location_at=? WHERE id=?', [online, lat, lng, now(), u.id]);
      return json({ ok: true });
    }
    if (path === '/v1/quote' && method === 'POST') { role(u, 'seller'); return json(quote(await body(request), env)); }
    if (path === '/v1/addresses' && method === 'GET') return json((await sql('SELECT * FROM addresses WHERE user_id=? ORDER BY label', [u.id])).rows);
    if (path === '/v1/addresses' && method === 'POST') {
      const b = await body(request), addressId = id();
      requireThat(Number((await one('SELECT COUNT(*) AS n FROM addresses WHERE user_id=?', [u.id]))!.n) < 50, 400, 'Address limit reached');
      await sql('INSERT INTO addresses VALUES (?,?,?,?,?,?)', [addressId, u.id, textField(b, 'label', 60), textField(b, 'address', 300), numberField(b, 'lat', -90, 90), numberField(b, 'lng', -180, 180)]);
      return json({ id: addressId }, 201);
    }
    if (path.startsWith('/v1/addresses/') && method === 'DELETE') { await sql('DELETE FROM addresses WHERE id=? AND user_id=?', [path.split('/').pop()!, u.id]); return json({ ok: true }); }
    if (path === '/v1/riders' && method === 'GET') {
      role(u, 'seller');
      return json((await sql(`SELECT u.id,u.name,u.online,COALESCE(AVG(r.stars),0) AS rating,COUNT(r.order_id) AS deliveries,
        EXISTS(SELECT 1 FROM favorites f WHERE f.seller_id=? AND f.rider_id=u.id) AS favorite
        FROM users u LEFT JOIN ratings r ON r.rider_id=u.id WHERE u.role='rider' AND u.approved=1 AND u.blocked=0 GROUP BY u.id ORDER BY favorite DESC,u.name LIMIT 200`, [u.id])).rows);
    }
    if (path.startsWith('/v1/favorites/') && ['POST', 'DELETE'].includes(method)) {
      role(u, 'seller'); const riderId = path.split('/').pop()!;
      if (method === 'POST') {
        requireThat(await one("SELECT id FROM users WHERE id=? AND role='rider' AND approved=1 AND blocked=0", [riderId]), 404, 'Approved rider not found');
        await sql('INSERT OR IGNORE INTO favorites VALUES (?,?)', [u.id, riderId]);
      } else await sql('DELETE FROM favorites WHERE seller_id=? AND rider_id=?', [u.id, riderId]);
      return json({ ok: true });
    }
    if (path === '/v1/jobs' && method === 'GET') {
      role(u, 'rider'); requireThat(u.approved && u.online && u.location_at && Number(u.location_at) > now() - 3600, 403, 'Go online with a fresh location to view jobs');
      const jobs = (await sql(`SELECT id,pickup_area,dropoff_area,pickup_lat,pickup_lng,size,scheduled_at,fee_minor,rider_pay_minor,currency,cod_minor,created_at
        FROM orders WHERE status='pending' AND scheduled_at<=? AND (preferred_rider_id IS NULL OR preferred_rider_id=? OR created_at<?) ORDER BY created_at DESC LIMIT 200`, [now() + 3600, u.id, now() - 300])).rows;
      return json(jobs.map((o): Row & { distance_km: number } => ({ ...o, distance_km: Math.round(distanceKm(Number(u.lat), Number(u.lng), Number(o.pickup_lat), Number(o.pickup_lng)) * 10) / 10 }))
        .filter(o => o.distance_km <= 10).map(o => { const { pickup_lat, pickup_lng, ...publicJob } = o; return publicJob; }).sort((a,b) => a.distance_km-b.distance_km));
    }
    if (path === '/v1/orders' && method === 'GET') {
      const offset = Number(url.searchParams.get('offset') ?? 0);
      requireThat(Number.isSafeInteger(offset) && offset >= 0, 400, 'Invalid offset');
      const rows = (await sql(u.role === 'admin' ? 'SELECT * FROM orders ORDER BY created_at DESC LIMIT 100 OFFSET ?' : 'SELECT * FROM orders WHERE seller_id=? OR rider_id=? ORDER BY created_at DESC LIMIT 100 OFFSET ?', u.role === 'admin' ? [offset] : [u.id, u.id, offset])).rows;
      return json(rows.map(o => visibleOrder(o, u)));
    }
    if (path === '/v1/orders' && method === 'POST') {
      role(u, 'seller'); const b = await body(request), requestId = textField(b, 'request_id', 80);
      const existing = await one('SELECT * FROM orders WHERE seller_id=? AND request_id=?', [u.id, requestId]);
      if (existing) return json({ ...visibleOrder(existing, u), tracking_url: `${url.origin}/track/${existing.tracking_token}` });
      const q = quote(b, env), orderId = id(), preferred = textField(b, 'preferred_rider_id', 80, true) || null;
      if (preferred) requireThat(await one("SELECT id FROM users WHERE id=? AND role='rider' AND approved=1 AND blocked=0", [preferred]), 400, 'Preferred rider unavailable');
      const scheduled = numberField(b, 'scheduled_at', now() - 300, now() + 30 * 86400, true);
      const cod = numberField(b, 'cod_minor', 0, Number(env.MAX_COD_MINOR ?? 1000000), true);
      const phone = textField(b, 'recipient_phone', 20);
      requireThat(/^(?:\+?88)?01[3-9]\d{8}$/.test(phone), 400, 'Invalid recipient mobile number');
      const columns = ['id','seller_id','preferred_rider_id','request_id','pickup_area','dropoff_area','pickup_address','dropoff_address','pickup_lat','pickup_lng','dropoff_lat','dropoff_lng','recipient_name','recipient_phone','size','instructions','scheduled_at','currency','fee_minor','rider_pay_minor','cod_minor','pickup_code','delivery_code','tracking_token','created_at','updated_at'];
      const args: InValue[] = [orderId,u.id,preferred,requestId,textField(b,'pickup_area',80),textField(b,'dropoff_area',80),textField(b,'pickup_address',300),textField(b,'dropoff_address',300),Number(b.pickup_lat),Number(b.pickup_lng),Number(b.dropoff_lat),Number(b.dropoff_lng),textField(b,'recipient_name',80),phone,String(b.size),textField(b,'instructions',500,true),scheduled,q.currency,q.fee_minor,q.rider_pay_minor,cod,randomCode(),randomCode(),randomToken(),now(),now()];
      await db.batch([{ sql: `INSERT INTO orders(${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')}) ON CONFLICT(seller_id,request_id) DO NOTHING`, args }, { sql: "INSERT INTO order_events SELECT ?,id,?,'pending','Delivery created',? FROM orders WHERE id=? AND changes()>0", args: [id(), u.id, now(), orderId] }], 'write');
      const o = (await one('SELECT * FROM orders WHERE seller_id=? AND request_id=?', [u.id, requestId]))!;
      return json({ ...visibleOrder(o, u), tracking_url: `${url.origin}/track/${o.tracking_token}` }, 201);
    }
    const match = path.match(/^\/v1\/orders\/([\w-]+)(?:\/(\w+))?$/);
    if (match) {
      const [, orderId, action] = match;
      if (action === 'accept' && method === 'POST') {
        role(u, 'rider'); requireThat(u.approved && u.online && Number(u.location_at) > now() - 3600, 403, 'Go online with a fresh location first');
        const job = await one('SELECT * FROM orders WHERE id=?', [orderId]);
        requireThat(job && job.seller_id !== u.id && distanceKm(Number(u.lat),Number(u.lng),Number(job.pickup_lat),Number(job.pickup_lng)) <= 10, 404, 'Job unavailable nearby');
        const results = await db.batch([
          { sql: "UPDATE orders SET rider_id=?,status='accepted',updated_at=? WHERE id=? AND status='pending' AND scheduled_at<=? AND (preferred_rider_id IS NULL OR preferred_rider_id=? OR created_at<?)", args: [u.id,now(),orderId,now()+3600,u.id,now()-300] },
          { sql: "INSERT INTO order_events SELECT ?,id,?,'accepted','Rider accepted',? FROM orders WHERE id=? AND changes()>0", args: [id(),u.id,now(),orderId] }
        ], 'write');
        requireThat(results[0].rowsAffected === 1, 409, 'Another rider accepted this delivery or it is not available yet');
        return json({ ok: true });
      }
      const o = await orderFor(u, orderId);
      if (!action && method === 'GET') return json({ ...visibleOrder(o,u), tracking_url: o.seller_id === u.id ? `${url.origin}/track/${o.tracking_token}` : null, seller_phone: o.rider_id === u.id ? (await one('SELECT phone FROM users WHERE id=?',[o.seller_id]))?.phone : null, events: (await sql('SELECT status,note,created_at FROM order_events WHERE order_id=? ORDER BY created_at,rowid', [orderId])).rows });
      if (action === 'messages' && method === 'GET') return json((await sql('SELECT id,sender_id,text,created_at FROM messages WHERE order_id=? ORDER BY created_at,rowid LIMIT 500',[orderId])).rows);
      if (action === 'messages' && method === 'POST') {
        requireThat(o.rider_id && !terminal.has(String(o.status)), 409, 'Chat is available during assigned deliveries');
        const b = await body(request); await limit(`messages:${u.id}`, 30, 60);
        await sql('INSERT INTO messages VALUES (?,?,?,?,?)', [id(),orderId,u.id,textField(b,'text',1000),now()]); return json({ ok: true },201);
      }
      if (action === 'location' && method === 'POST') {
        role(u,'rider'); requireThat(o.rider_id === u.id && !terminal.has(String(o.status)),403,'Active assigned delivery required');
        const b = await body(request); await sql('UPDATE orders SET rider_lat=?,rider_lng=?,location_at=? WHERE id=? AND rider_id=? AND status NOT IN (\'delivered\',\'returned\',\'cancelled\')', [numberField(b,'lat',-90,90),numberField(b,'lng',-180,180),now(),orderId,u.id]); return json({ ok: true });
      }
      if (action === 'rating' && method === 'POST') {
        role(u,'seller'); requireThat(o.seller_id === u.id && o.status === 'delivered',403,'Rate your completed delivery');
        const b = await body(request);
        await sql('INSERT INTO ratings VALUES (?,?,?,?,?,?) ON CONFLICT(order_id) DO UPDATE SET stars=excluded.stars,comment=excluded.comment', [orderId,u.id,o.rider_id,numberField(b,'stars',1,5,true),textField(b,'comment',500,true),now()]); return json({ ok:true });
      }
      if (action === 'transition' && method === 'POST') {
        const b = await body(request), step = textField(b,'action'), next = transition(String(u.role),String(o.status),step);
        requireThat((u.role === 'seller' && o.seller_id === u.id) || (u.role === 'rider' && o.rider_id === u.id && u.approved),403,'Only the assigned account can change this delivery');
        let note = textField(b,'note',300,true);
        if (['fail','return'].includes(step)) requireThat(note.length > 0,400,'Explain the delivery problem');
        const expected = ['pickup','returned'].includes(step) ? o.pickup_code : step === 'deliver' ? o.delivery_code : null;
        if (expected) {
          requireThat(Number(o.code_attempts) < 5,423,'Code attempts exhausted. Contact support.');
          if (!equal(textField(b,'code',6),String(expected))) {
            await sql('UPDATE orders SET code_attempts=MIN(code_attempts+1,5) WHERE id=? AND status=? AND rider_id=?',[orderId,o.status,u.id]);
            throw new HttpError(400,'Incorrect confirmation code');
          }
        }
        const collected = step === 'deliver' ? numberField(b,'cod_collected_minor',0,Number(env.MAX_COD_MINOR ?? 1000000),true) : Number(o.cod_collected_minor);
        if (step === 'deliver') requireThat(collected === Number(o.cod_minor),400,'Confirm the exact cash amount before completing delivery');
        if (!note) note = step;
        const results = await db.batch([
          { sql: 'UPDATE orders SET status=?,rider_id=?,cod_collected_minor=?,code_attempts=0,updated_at=?,rider_lat=NULL,rider_lng=NULL,location_at=NULL WHERE id=? AND status=? AND rider_id IS ? AND code_attempts<5', args: [next,step === 'release' ? null : o.rider_id,collected,now(),orderId,o.status,o.rider_id] },
          { sql: 'INSERT INTO order_events SELECT ?,id,?,?,?,? FROM orders WHERE id=? AND changes()>0', args: [id(),u.id,next,note,now(),orderId] }
        ],'write');
        requireThat(results[0].rowsAffected===1,409,'Delivery changed. Refresh and try again.'); return json({ ok:true,status:next });
      }
      throw new HttpError(404,'Not found');
    }
    if (path === '/v1/summary' && method === 'GET') {
      const o = await one(`SELECT COUNT(*) AS total,SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered,
        COALESCE(SUM(CASE WHEN status='delivered' THEN rider_pay_minor ELSE 0 END),0) AS earnings_minor,
        COALESCE(SUM(CASE WHEN status='delivered' AND cod_settled_at IS NULL THEN cod_collected_minor ELSE 0 END),0) AS cod_pending_minor
        FROM orders WHERE seller_id=? OR rider_id=?`,[u.id,u.id]); return json({ ...o,currency:env.CURRENCY ?? 'BDT' });
    }
    if (path === '/v1/tickets' && method === 'GET') return json((await sql(u.role==='admin'?'SELECT * FROM tickets ORDER BY created_at DESC LIMIT 200':'SELECT * FROM tickets WHERE user_id=? ORDER BY created_at DESC LIMIT 200',u.role==='admin'?[]:[u.id])).rows);
    if (path === '/v1/tickets' && method === 'POST') {
      const b = await body(request), orderId = textField(b,'order_id',80,true) || null;
      if (orderId) await orderFor(u,orderId); await limit(`tickets:${u.id}`,10,3600);
      const ticketId = id(); await sql('INSERT INTO tickets(id,user_id,order_id,subject,message,created_at) VALUES (?,?,?,?,?,?)',[ticketId,u.id,orderId,textField(b,'subject',100),textField(b,'message',2000),now()]); return json({ id:ticketId },201);
    }
    if (path.startsWith('/v1/admin/')) {
      role(u,'admin');
      if (path === '/v1/admin/users' && method==='GET') return json((await sql('SELECT id,name,email,phone,role,approved,blocked FROM users ORDER BY created_at DESC LIMIT 200')).rows);
      const b = method==='POST' ? await body(request) : {};
      if (path === '/v1/admin/user' && method==='POST') {
        const target = textField(b,'user_id',80), approved = numberField(b,'approved',0,1,true), blocked = numberField(b,'blocked',0,1,true);
        requireThat(await one("SELECT id FROM users WHERE id=? AND role!='admin'",[target]),404,'Seller or rider not found');
        await db.batch([{ sql:'UPDATE users SET approved=?,blocked=?,online=0 WHERE id=?',args:[approved,blocked,target] },{ sql:'DELETE FROM sessions WHERE user_id=? AND ?=1',args:[target,blocked] },{ sql:'INSERT INTO audit VALUES (?,?,?,?,?)',args:[id(),u.id,`approved=${approved};blocked=${blocked}`,target,now()] }],'write'); return json({ ok:true });
      }
      if (path === '/v1/admin/settle' && method==='POST') {
        const orderId = textField(b,'order_id',80), o = await orderFor(u,orderId);
        requireThat(o.status==='delivered' && Number(o.cod_collected_minor)>0 && !o.cod_settled_at,409,'No unsettled COD for this delivery');
        await db.batch([{ sql:"UPDATE orders SET cod_settled_at=? WHERE id=? AND status='delivered' AND cod_settled_at IS NULL",args:[now(),orderId] },{ sql:'INSERT INTO audit SELECT ?,?,?,?,? WHERE changes()>0',args:[id(),u.id,'COD settlement confirmed',orderId,now()] }],'write'); return json({ ok:true });
      }
      if (path === '/v1/admin/unlock' && method==='POST') { const orderId=textField(b,'order_id',80); await orderFor(u,orderId); await sql('UPDATE orders SET code_attempts=0 WHERE id=?',[orderId]); await audit(u,'Confirmation codes unlocked',orderId); return json({ ok:true }); }
      if (path === '/v1/admin/ticket' && method==='POST') {
        const ticketId=textField(b,'ticket_id',80), status=textField(b,'status'); requireThat(['open','resolved'].includes(status),400,'Invalid ticket status');
        requireThat((await sql('UPDATE tickets SET reply=?,status=? WHERE id=?',[textField(b,'reply',2000),status,ticketId])).rowsAffected,404,'Ticket not found'); await audit(u,'Support reply',ticketId); return json({ ok:true });
      }
    }
    throw new HttpError(404,'Not found');
  }
  async function trackingPage(token: string) {
    requireThat(/^[a-f0-9]{64}$/.test(token),404,'Tracking link not found');
    // ponytail: polling keeps tracking simple; switch to push when delivery volume justifies it.
    const o=await one('SELECT status,pickup_area,dropoff_area,scheduled_at,rider_lat,rider_lng,location_at,updated_at FROM orders WHERE tracking_token=?',[token]);
    requireThat(o,404,'Tracking link not found');
    return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="30"><title>ParcelBridge tracking</title><style>body{font:18px system-ui;margin:40px auto;padding:24px;max-width:560px;background:#f4f8fb;color:#16324f}h1{color:#007f73}pre{white-space:pre-wrap}</style><h1>ParcelBridge</h1><h2>Delivery tracking · Feni</h2><pre id="delivery"></pre><script>const o=${JSON.stringify(o).replace(/</g,'\\u003c')};document.getElementById('delivery').textContent='Status: '+o.status.replaceAll('_',' ')+'\\nFrom: '+o.pickup_area+'\\nTo: '+o.dropoff_area+'\\nUpdated: '+new Date(o.updated_at*1000).toLocaleString();if(o.rider_lat!==null&&o.location_at>Date.now()/1000-300){const a=document.createElement('a');a.href='https://www.google.com/maps?q='+o.rider_lat+','+o.rider_lng;a.textContent='View rider’s last shared location';document.body.append(a);}</script><p>Refreshes every 30 seconds. Contact your seller for help.</p></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"}});
  }
  return async (request: Request) => {
    try { return await handle(request); }
    catch (e) {
      if (e instanceof HttpError) return json({ error:e.message },e.status);
      if (e instanceof Error && /UNIQUE constraint failed/.test(e.message)) return json({ error:'This record already exists. Refresh and try again.' },409);
      console.error('Request failed',e instanceof Error ? e.name : 'unknown');
      return json({ error:'Service temporarily unavailable. Please try again.' },503);
    }
  };
}
export default {
  async fetch(request: Request, env: Env) {
    const db=createClient({url:env.TURSO_DATABASE_URL,authToken:env.TURSO_AUTH_TOKEN});
    try { return await createApp(db,env)(request); } finally { db.close(); }
  },
  async scheduled(_controller: ScheduledController, env: Env) {
    const db=createClient({url:env.TURSO_DATABASE_URL,authToken:env.TURSO_AUTH_TOKEN});
    try { await db.batch([{sql:'DELETE FROM sessions WHERE expires_at<?',args:[now()]},{sql:'DELETE FROM rate_limits WHERE reset_at<?',args:[now()]},{sql:'UPDATE users SET online=0 WHERE location_at<?',args:[now()-3600]}],'write'); } finally { db.close(); }
  }
};
