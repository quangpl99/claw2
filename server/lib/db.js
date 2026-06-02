const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

// Data directory
const DATA_DIR = path.join(os.homedir(), '.shipfast-docs');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'shipfast.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDb() {
  const db = getDb();

  // Accounts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      plan TEXT DEFAULT 'free' CHECK(plan IN ('free', 'starter', 'pro')),
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      api_key TEXT UNIQUE DEFAULT (lower(hex(randomblob(24)))),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Documents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      url TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'ready', 'failed')),
      chunk_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Chunks table (document content for embedding)
  db.exec(`
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      token_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Embeddings table (stored as JSON vectors in FTS5)
  db.exec(`
    CREATE TABLE IF NOT EXISTS embeddings (
      chunk_id TEXT PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
      doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      vector BLOB NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Chat messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      tokens_used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Usage tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS usage (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      chat_count INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_id, month)
    )
  `);

  // API keys table (for additional API keys per account)
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      key TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      name TEXT,
      last_used DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // FTS5 virtual table for semantic search
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
      content,
      content_rowid='rowid',
      tokenize='porter unicode61'
    );
  `);

  // Triggers to keep FTS in sync
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
      INSERT INTO chunks_fts(rowid, content) VALUES (NEW.rowid, NEW.content);
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
      INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES('delete', OLD.rowid, OLD.content);
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
      INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES('delete', OLD.rowid, OLD.content);
      INSERT INTO chunks_fts(rowid, content) VALUES (NEW.rowid, NEW.content);
    END;
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_documents_account ON documents(account_id);
    CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(doc_id);
    CREATE INDEX IF NOT EXISTS idx_embeddings_doc ON embeddings(doc_id);
    CREATE INDEX IF NOT EXISTS idx_messages_doc ON messages(doc_id);
    CREATE INDEX IF NOT EXISTS idx_usage_account_month ON usage(account_id, month);
  `);

  console.log('Database initialized at', DB_PATH);
  return db;
}

// Helper: Get or create account by email
function getOrCreateAccount(email, name = null) {
  const db = getDb();
  let account = db.prepare('SELECT * FROM accounts WHERE email = ?').get(email);
  if (!account) {
    const id = uuidv4();
    const apiKey = generateApiKey();
    db.prepare(`
      INSERT INTO accounts (id, email, name, api_key)
      VALUES (?, ?, ?, ?)
    `).run(id, email, name || email.split('@')[0]);
    account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  }
  return account;
}

// Helper: Generate API key
function generateApiKey() {
  return 'sf_' + Array.from({ length: 32 }, () =>
    Math.random().toString(36).charAt(2)
  ).join('');
}

// Helper: Check and increment usage
function checkUsage(accountId, plan) {
  const limits = {
    free: { docs: 1, chats: 100 },
    starter: { docs: 5, chats: 5000 },
    pro: { docs: -1, chats: 25000 },
  };

  const { docs: docLimit, chats: chatLimit } = limits[plan] || limits.free;
  const db = getDb();

  // Check doc count
  const docCount = db.prepare('SELECT COUNT(*) as c FROM documents WHERE account_id = ?')
    .get(accountId).c;

  if (docLimit !== -1 && docCount >= docLimit) {
    throw new Error(`Document limit reached (${docLimit}). Upgrade your plan.`);
  }

  // Check monthly chat usage
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  let usage = db.prepare('SELECT * FROM usage WHERE account_id = ? AND month = ?')
    .get(accountId, month);

  if (!usage) {
    db.prepare('INSERT INTO usage (account_id, month) VALUES (?, ?)').run(accountId, month);
    usage = db.prepare('SELECT * FROM usage WHERE account_id = ? AND month = ?')
      .get(accountId, month);
  }

  if (usage.chat_count >= chatLimit) {
    throw new Error(`Monthly chat limit reached (${chatLimit}). Upgrade your plan.`);
  }

  return { docCount, chatCount: usage.chat_count, chatLimit };
}

// Helper: Increment chat count
function incrementUsage(accountId) {
  const db = getDb();
  const month = new Date().toISOString().slice(0, 7);
  db.prepare('UPDATE usage SET chat_count = chat_count + 1 WHERE account_id = ? AND month = ?')
    .run(accountId, month);
}

module.exports = {
  getDb,
  initDb,
  getOrCreateAccount,
  generateApiKey,
  checkUsage,
  incrementUsage,
};