import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createClient } from '@libsql/client';
import { createApp, type Env } from '../src/index';
import { distanceKm, quote, transition, validManifest } from '../src/domain';

const env: Env = { TURSO_DATABASE_URL: ':memory:', TURSO_AUTH_TOKEN: '', CURRENCY:'BDT' };
async function fixture() {
  const db=createClient({url:':memory:'});
  await db.executeMultiple(await readFile(new URL('../schema.sql',import.meta.url),'utf8'));
  const app=createApp(db,env);
  let ip=0;
  async function call(path:string,method='GET',data?:unknown,token?:string) {
    const response=await app(new Request('https://parcelbridge.example'+path,{method,headers:{'Content-Type':'application/json','CF-Connecting-IP':String(++ip),...(token?{Authorization:`Bearer ${token}`}:{})},body:data===undefined?undefined:JSON.stringify(data)}));
    const value=response.headers.get('Content-Type')?.includes('json') ? await response.json() as any : await response.text();
    return {status:response.status,value};
  }
  async function register(role='seller',email=crypto.randomUUID()+'@example.com') {
    const result=await call('/v1/auth/register','POST',{email,password:'a safe password 123',name:role,phone:'01712345678',role});
    assert.equal(result.status,201,JSON.stringify(result.value));
    return result.value as {token:string;user:{id:string;role:string}};
  }
  const seller=await register(); const rider=await register('rider'); const other=await register(); const admin=await register();
  await db.execute({sql:"UPDATE users SET role='admin' WHERE id=?",args:[admin.user.id]});
  await db.execute({sql:'UPDATE users SET approved=1 WHERE id=?',args:[rider.user.id]});
  await call('/v1/me/availability','POST',{online:1,lat:23.0144,lng:91.3966},rider.token);
  const booking={request_id:crypto.randomUUID(),pickup_area:'Feni centre',dropoff_area:'Hospital area',pickup_address:'Test pickup',dropoff_address:'Test destination',pickup_lat:23.0144,pickup_lng:91.3966,dropoff_lat:23.022,dropoff_lng:91.40,recipient_name:'Customer',recipient_phone:'01812345678',size:'small',instructions:'Handle carefully',scheduled_at:Math.floor(Date.now()/1000),cod_minor:12345};
  async function create(data={}) {
    const result=await call('/v1/orders','POST',{...booking,request_id:crypto.randomUUID(),...data},seller.token);
    assert.equal(result.status,201,JSON.stringify(result.value));return result.value;
  }
  async function accept(order:any,who=rider) { const r=await call(`/v1/orders/${order.id}/accept`,'POST',{},who.token);assert.equal(r.status,200,JSON.stringify(r.value)); }
  async function step(order:any,action:string,extras={}) { return call(`/v1/orders/${order.id}/transition`,'POST',{action,...extras},rider.token); }
  return {db,call,register,seller,rider,other,admin,booking,create,accept,step};
}

test('Feni coverage, cash integers, distance and allowed transitions',()=>{
  assert.equal(distanceKm(23,91,23,91),0);
  assert.ok(Math.abs(distanceKm(0,0,0,1)-111.195)<0.01);
  assert.throws(()=>quote({pickup_lat:23.7,pickup_lng:90.4,dropoff_lat:23.72,dropoff_lng:90.42,size:'small'},env),/Feni/);
  assert.throws(()=>quote({pickup_lat:NaN,pickup_lng:91.4,dropoff_lat:23.02,dropoff_lng:91.4,size:'small'},env),/pickup_lat/);
  assert.equal(transition('rider','failed','return'),'returning');
  assert.throws(()=>transition('seller','accepted','deliver'));
  const manifest={versionCode:2,versionName:'0.2',sha256:'a'.repeat(64),apkUrl:'https://github.com/shop/app/releases/download/v0.2/parcelbridge.apk'};
  assert.equal(validManifest(manifest,'shop/app').versionCode,2);
  assert.throws(()=>validManifest({...manifest,apkUrl:'https://evil.example/parcelbridge.apk'},'shop/app'));
});

test('registration cannot create admins and sessions store only token digests',async()=>{
  const f=await fixture();try {
    assert.equal((await f.call('/v1/auth/register','POST',{email:'evil@example.com',password:'a safe password 123',name:'Evil',phone:'01712345678',role:'admin'})).status,400);
    const sessions=await f.db.execute('SELECT token_hash FROM sessions');
    assert.ok(sessions.rows.every(r=>r.token_hash!==f.seller.token));
    assert.equal((await f.call('/v1/me')).status,401);
    assert.equal((await f.call('/v1/admin/users','GET',undefined,f.seller.token)).status,403);
    const response=await f.call('/v1/me','GET',undefined,f.seller.token);assert.equal(response.status,200);assert.equal(response.value.password_hash,undefined);
  } finally { f.db.close(); }
});

test('idempotent bookings preserve one delivery and one creation event',async()=>{
  const f=await fixture();try {
    const a=await f.call('/v1/orders','POST',f.booking,f.seller.token);
    const b=await f.call('/v1/orders','POST',f.booking,f.seller.token);
    assert.equal(a.status,201);assert.equal(b.status,200);assert.equal(a.value.id,b.value.id);
    assert.equal(Number((await f.db.execute('SELECT COUNT(*) n FROM order_events')).rows[0].n),1);
    assert.equal((await f.call('/v1/orders','POST',{...f.booking,request_id:'bad',cod_minor:12.5},f.seller.token)).status,400);
  } finally {f.db.close();}
});

test('unapproved riders are rejected and job feed protects customer information',async()=>{
  const f=await fixture();try {
    const o=await f.create(); const pending=await f.register('rider');
    assert.equal((await f.call(`/v1/orders/${o.id}/accept`,'POST',{},pending.token)).status,403);
    const feed=await f.call('/v1/jobs','GET',undefined,f.rider.token);assert.equal(feed.status,200);
    assert.equal(feed.value[0].recipient_phone,undefined);assert.equal(feed.value[0].pickup_address,undefined);assert.equal(feed.value[0].pickup_lat,undefined);
    assert.equal((await f.call(`/v1/orders/${o.id}`,'GET',undefined,f.other.token)).status,403);
  } finally { f.db.close(); }
});

test('two riders competing for the same delivery cannot both accept',async()=>{
  const f=await fixture();try {
    const o=await f.create();const second=await f.register('rider');
    await f.db.execute({sql:'UPDATE users SET approved=1,online=1,lat=23.0144,lng=91.3966,location_at=? WHERE id=?',args:[Math.floor(Date.now()/1000),second.user.id]});
    const results=await Promise.all([f.call(`/v1/orders/${o.id}/accept`,'POST',{},f.rider.token),f.call(`/v1/orders/${o.id}/accept`,'POST',{},second.token)]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
    assert.equal(Number((await f.db.execute("SELECT COUNT(*) n FROM order_events WHERE status='accepted'")).rows[0].n),1);
  } finally { f.db.close(); }
});

test('preferred rider reservation expires and future jobs are not claimable early',async()=>{
  const f=await fixture();try {
    const preferred=await f.register('rider');await f.db.execute({sql:'UPDATE users SET approved=1 WHERE id=?',args:[preferred.user.id]});
    const o=await f.create({preferred_rider_id:preferred.user.id});
    assert.equal((await f.call(`/v1/orders/${o.id}/accept`,'POST',{},f.rider.token)).status,409);
    await f.db.execute({sql:'UPDATE orders SET created_at=created_at-301 WHERE id=?',args:[o.id]});await f.accept(o);
    const scheduled=await f.create({scheduled_at:Math.floor(Date.now()/1000)+7200});
    assert.equal((await f.call(`/v1/orders/${scheduled.id}/accept`,'POST',{},f.rider.token)).status,409);
  } finally {f.db.close();}
});

test('delivery codes, COD and audited manual settlement complete a delivery',async()=>{
  const f=await fixture();try {
    const o=await f.create();await f.accept(o);
    const riderView=await f.call(`/v1/orders/${o.id}`,'GET',undefined,f.rider.token);assert.equal(riderView.value.pickup_code,undefined);assert.equal(riderView.value.delivery_code,undefined);
    assert.ok(!JSON.stringify(riderView.value).includes(o.pickup_code));assert.ok(!JSON.stringify(riderView.value).includes(o.delivery_code));assert.ok(!Object.keys(riderView.value).some(k=>/^\d+$/.test(k)));
    assert.equal((await f.step(o,'pickup',{code:'000000'})).status,400);
    assert.equal((await f.step(o,'pickup',{code:o.pickup_code})).status,200);
    assert.equal((await f.step(o,'deliver',{code:o.delivery_code,cod_collected_minor:0})).status,400);
    assert.equal((await f.step(o,'deliver',{code:o.delivery_code,cod_collected_minor:12345})).status,200);
    assert.equal((await f.step(o,'deliver',{code:o.delivery_code,cod_collected_minor:12345})).status,409);
    assert.equal((await f.call('/v1/admin/settle','POST',{order_id:o.id},f.seller.token)).status,403);
    assert.equal((await f.call('/v1/admin/settle','POST',{order_id:o.id},f.admin.token)).status,200);
    assert.equal((await f.call('/v1/admin/settle','POST',{order_id:o.id},f.admin.token)).status,409);
    assert.equal((await f.call(`/v1/orders/${o.id}/rating`,'POST',{stars:5,comment:'Good'},f.seller.token)).status,200);
    const summary=await f.call('/v1/summary','GET',undefined,f.seller.token);assert.equal(summary.value.delivered,1);assert.equal(summary.value.cod_pending_minor,0);
    assert.equal(Number((await f.db.execute('SELECT COUNT(*) n FROM audit')).rows[0].n),1);
  } finally { f.db.close(); }
});

test('five incorrect codes lock confirmation until an admin unlocks it',async()=>{
  const f=await fixture();try {
    const o=await f.create();await f.accept(o);
    for(let i=0;i<5;i++) assert.equal((await f.step(o,'pickup',{code:'000000'})).status,400);
    assert.equal((await f.step(o,'pickup',{code:o.pickup_code})).status,423);
    assert.equal((await f.call('/v1/admin/unlock','POST',{order_id:o.id},f.admin.token)).status,200);
    assert.equal((await f.step(o,'pickup',{code:o.pickup_code})).status,200);
  } finally { f.db.close(); }
});

test('failed deliveries can retry or return, never skip return confirmation',async()=>{
  const f=await fixture();try {
    const o=await f.create();await f.accept(o);await f.step(o,'pickup',{code:o.pickup_code});
    assert.equal((await f.step(o,'fail')).status,400);assert.equal((await f.step(o,'fail',{note:'Customer absent'})).status,200);
    assert.equal((await f.step(o,'retry')).status,200);await f.step(o,'fail',{note:'Customer refused'});
    assert.equal((await f.step(o,'return',{note:'Return requested'})).status,200);
    assert.equal((await f.step(o,'returned',{code:'000000'})).status,400);assert.equal((await f.step(o,'returned',{code:o.pickup_code})).status,200);
  } finally {f.db.close();}
});

test('chat, saved addresses and support remain scoped to account or delivery',async()=>{
  const f=await fixture();try {
    const o=await f.create();await f.accept(o);
    assert.equal((await f.call(`/v1/orders/${o.id}/messages`,'POST',{text:'I am arriving'},f.rider.token)).status,201);
    assert.equal((await f.call(`/v1/orders/${o.id}/messages`,'GET',undefined,f.other.token)).status,403);
    const addr=await f.call('/v1/addresses','POST',{label:'Shop',address:'Feni centre',lat:23.0144,lng:91.3966},f.seller.token);assert.equal(addr.status,201);
    await f.call(`/v1/addresses/${addr.value.id}`,'DELETE',undefined,f.other.token);
    assert.equal((await f.call('/v1/addresses','GET',undefined,f.seller.token)).value.length,1);
    assert.equal((await f.call('/v1/tickets','POST',{order_id:o.id,subject:'Help',message:'Please call'},f.other.token)).status,403);
    assert.equal((await f.call('/v1/tickets','POST',{order_id:o.id,subject:'Help',message:'Please call'},f.seller.token)).status,201);
    assert.equal((await f.call('/v1/tickets','GET',undefined,f.other.token)).value.length,0);
  } finally {f.db.close();}
});

test('tracking excludes phone numbers, codes and full addresses and escapes markup',async()=>{
  const f=await fixture();try {
    const o=await f.create({pickup_area:'<script>alert(1)</script>'});
    const response=await f.call(new URL(o.tracking_url).pathname);
    assert.equal(response.status,200);assert.ok(!response.value.includes(o.recipient_phone));assert.ok(!response.value.includes(o.pickup_code));assert.ok(!response.value.includes('Test pickup'));assert.ok(!response.value.includes('<script>alert(1)</script>'));
    assert.equal((await f.call('/track/not-a-token')).status,404);
  } finally {f.db.close();}
});

test('blocked users and revoked sessions cannot read or mutate deliveries',async()=>{
  const f=await fixture();try {
    await f.call('/v1/admin/user','POST',{user_id:f.rider.user.id,approved:1,blocked:1},f.admin.token);
    assert.equal((await f.call('/v1/me','GET',undefined,f.rider.token)).status,401);
    await f.call('/v1/auth/logout','POST',{},f.seller.token);
    assert.equal((await f.call('/v1/me','GET',undefined,f.seller.token)).status,401);
  } finally {f.db.close();}
});

test('trust boundaries reject malformed and oversized request bodies',async()=>{
  const f=await fixture();try {
    assert.equal((await f.call('/v1/orders','POST',{...f.booking,instructions:'x'.repeat(17000)},f.seller.token)).status,413);
    assert.equal((await f.call('/v1/orders','POST',[],f.seller.token)).status,400);
    assert.equal((await f.call('/v1/orders?offset=-1','GET',undefined,f.seller.token)).status,400);
    assert.equal((await f.call('/v1/updates')).status,503);
  } finally {f.db.close();}
});

test('password changes preserve spaces and revoke existing sessions',async()=>{
  const f=await fixture();try {
    const password='  replacement password  ';
    const result=await f.call('/v1/me/password','POST',{current_password:'a safe password 123',new_password:password},f.seller.token);
    assert.equal(result.status,200);
    assert.equal((await f.call('/v1/me','GET',undefined,f.seller.token)).status,401);
    const email=String((await f.db.execute({sql:'SELECT email FROM users WHERE id=?',args:[f.seller.user.id]})).rows[0].email);
    assert.equal((await f.call('/v1/auth/login','POST',{email,password:password.trim()})).status,401);
    assert.equal((await f.call('/v1/auth/login','POST',{email,password})).status,200);
  } finally {f.db.close();}
});
