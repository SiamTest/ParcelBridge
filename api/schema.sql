PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL,
 password_hash TEXT NOT NULL, salt TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('seller','rider','admin')),
 approved INTEGER NOT NULL DEFAULT 0, blocked INTEGER NOT NULL DEFAULT 0,
 online INTEGER NOT NULL DEFAULT 0, lat REAL, lng REAL, location_at INTEGER,
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (
 key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS addresses (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), label TEXT NOT NULL,
 address TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS favorites (
 seller_id TEXT NOT NULL REFERENCES users(id), rider_id TEXT NOT NULL REFERENCES users(id),
 PRIMARY KEY(seller_id,rider_id)
);
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY, seller_id TEXT NOT NULL REFERENCES users(id), rider_id TEXT REFERENCES users(id),
 preferred_rider_id TEXT REFERENCES users(id), request_id TEXT NOT NULL,
 pickup_area TEXT NOT NULL, dropoff_area TEXT NOT NULL,
 pickup_address TEXT NOT NULL, dropoff_address TEXT NOT NULL,
 pickup_lat REAL NOT NULL, pickup_lng REAL NOT NULL, dropoff_lat REAL NOT NULL, dropoff_lng REAL NOT NULL,
 recipient_name TEXT NOT NULL, recipient_phone TEXT NOT NULL, size TEXT NOT NULL,
 instructions TEXT NOT NULL, scheduled_at INTEGER NOT NULL,
 currency TEXT NOT NULL, fee_minor INTEGER NOT NULL, rider_pay_minor INTEGER NOT NULL,
 cod_minor INTEGER NOT NULL DEFAULT 0, cod_collected_minor INTEGER NOT NULL DEFAULT 0,
 cod_settled_at INTEGER, status TEXT NOT NULL DEFAULT 'pending'
 CHECK(status IN ('pending','accepted','picked_up','delivered','failed','returning','returned','cancelled')),
 pickup_code TEXT NOT NULL, delivery_code TEXT NOT NULL, code_attempts INTEGER NOT NULL DEFAULT 0,
 tracking_token TEXT UNIQUE NOT NULL, rider_lat REAL, rider_lng REAL, location_at INTEGER,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 UNIQUE(seller_id,request_id)
);
CREATE INDEX IF NOT EXISTS orders_seller ON orders(seller_id,created_at);
CREATE INDEX IF NOT EXISTS orders_rider ON orders(rider_id,status);
CREATE INDEX IF NOT EXISTS orders_feed ON orders(status,scheduled_at);
CREATE TABLE IF NOT EXISTS order_events (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), actor_id TEXT NOT NULL REFERENCES users(id),
 status TEXT NOT NULL, note TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), sender_id TEXT NOT NULL REFERENCES users(id),
 text TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ratings (
 order_id TEXT PRIMARY KEY REFERENCES orders(id), seller_id TEXT NOT NULL REFERENCES users(id),
 rider_id TEXT NOT NULL REFERENCES users(id), stars INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5),
 comment TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tickets (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), order_id TEXT REFERENCES orders(id),
 subject TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
 reply TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS audit (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL,
 target_id TEXT NOT NULL, created_at INTEGER NOT NULL
);
