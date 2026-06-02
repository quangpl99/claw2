const express = require('express');
const router = express.Router();
const { getDb, getOrCreateAccount, checkUsage } = require('../lib/db');
const { embedText, embeddingToBase64, estimateTokens } = require('../lib/openai');
const { v4: uuidv4 } = require('uuid');
const marked = require('marked');

// Auth middleware
function authMiddleware(req, res, next) {
  const apiKey = req.headers.authorization?.replace('Bearer ', '');
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  const db = getDb();
  const account = db.prepare('SELECT * FROM accounts WHERE api_key = ?').get(apiKey);
  if (!account) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  req.account = account;
  next();
}

// Chunk text into smaller pieces
function chunkText(text, maxTokens = 500) {
  // Split by double newlines first
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());

  const chunks = [];
  let currentChunk = '';
  let currentTokens = 0;

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);

    if (currentTokens + paraTokens > maxTokens && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = para;
      currentTokens = paraTokens;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
      currentTokens += paraTokens;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// Upload a document
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { url, title, content } = req.body;

    if (!content && !url) {
      return res.status(400).json({ error: 'Either content or url is required' });
    }

    const db = getDb();
    const account = req.account;

    // Check usage limits
    checkUsage(account.id, account.plan);

    // Fetch content if URL provided
    let textContent = content || '';
    if (url) {
      try {
        const response = await fetch(url);
        textContent = await response.text();
      } catch (err) {
        return res.status(400).json({ error: 'Failed to fetch URL: ' + err.message });
      }
    }

    // Strip HTML if present
    textContent = textContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    // Parse markdown if content looks like markdown
    if (textContent.includes('#') || textContent.includes('```')) {
      textContent = marked.parse(textContent);
    }

    if (!textContent || textContent.length < 20) {
      return res.status(400).json({ error: 'Content too short or empty' });
    }

    const docId = uuidv4();
    const docTitle = title || url || 'Untitled Document';

    // Create document record
    db.prepare(`
      INSERT INTO documents (id, account_id, title, url, status, chunk_count)
      VALUES (?, ?, ?, ?, 'processing', 0)
    `).run(docId, account.id, docTitle, url || null);

    // Chunk text
    const chunks = chunkText(textContent);
    const insertChunk = db.prepare(`
      INSERT INTO chunks (id, doc_id, content, chunk_index, token_count)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertEmbed = db.prepare(`
      INSERT INTO embeddings (chunk_id, doc_id, vector)
      VALUES (?, ?, ?)
    `);

    const insertMany = db.transaction((chunks) => {
      for (let i = 0; i < chunks.length; i++) {
        const chunkId = uuidv4();
        const tokens = estimateTokens(chunks[i]);
        insertChunk.run(chunkId, docId, chunks[i], i, tokens);

        // Embed asynchronously
        embedText(chunks[i]).then((vector) => {
          const base64Vec = embeddingToBase64(vector);
          insertEmbed.run(chunkId, docId, base64Vec);
        }).catch(console.error);
      }
    });

    insertMany(chunks);

    // Update document status
    db.prepare(`
      UPDATE documents SET status = 'ready', chunk_count = ? WHERE id = ?
    `).run(chunks.length, docId);

    res.status(201).json({
      id: docId,
      title: docTitle,
      url,
      status: 'ready',
      chunk_count: chunks.length,
    });
  } catch (err) {
    console.error('Error uploading document:', err);
    res.status(500).json({ error: err.message || 'Failed to upload document' });
  }
});

// List documents
router.get('/', authMiddleware, (req, res) => {
  const db = getDb();
  const docs = db.prepare(`
    SELECT id, title, url, status, chunk_count, created_at
    FROM documents
    WHERE account_id = ?
    ORDER BY created_at DESC
  `).all(req.account.id);

  res.json({ documents: docs });
});

// Get one document
router.get('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const doc = db.prepare(`
    SELECT * FROM documents WHERE id = ? AND account_id = ?
  `).get(req.params.id, req.account.id);

  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const chunks = db.prepare(`
    SELECT id, content, chunk_index FROM chunks WHERE doc_id = ? ORDER BY chunk_index
  `).all(doc.id);

  res.json({ ...doc, chunks });
});

// Delete document
router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND account_id = ?')
    .get(req.params.id, req.account.id);

  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  db.prepare('DELETE FROM documents WHERE id = ?').run(doc.id);
  res.json({ success: true });
});

module.exports = router;