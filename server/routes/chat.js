const express = require('express');
const router = express.Router();
const { getDb, checkUsage, incrementUsage } = require('../lib/db');
const { embedText, base64ToEmbedding, cosineSimilarity, answerQuestion } = require('../lib/openai');

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

// Search for relevant chunks
async function findRelevantChunks(docId, question, topK = 5) {
  const db = getDb();

  // First verify doc belongs to account and is ready
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND account_id = ? AND status = ?')
    .get(docId, db.prepare('SELECT account_id FROM accounts WHERE api_key = ?')
      .get(req.headers.authorization?.replace('Bearer ', ''))?.account_id || '', 'ready');

  // Get all embeddings for this doc
  const embeddings = db.prepare(`
    SELECT e.chunk_id, e.vector, c.content, c.chunk_index
    FROM embeddings e
    JOIN chunks c ON c.id = e.chunk_id
    WHERE e.doc_id = ?
  `).all(docId);

  if (embeddings.length === 0) {
    return [];
  }

  // Embed the question
  const questionEmbedding = await embedText(question);

  // Score each chunk
  const scored = embeddings.map(e => {
    const vector = base64ToEmbedding(e.vector);
    const similarity = cosineSimilarity(questionEmbedding, vector);
    return { ...e, similarity };
  });

  // Sort by similarity and return top K
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK);
}

// Chat with a document
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { question, doc_id } = req.body;

    if (!question || !doc_id) {
      return res.status(400).json({ error: 'question and doc_id are required' });
    }

    const db = getDb();
    const account = req.account;

    // Check usage
    const usage = checkUsage(account.id, account.plan);

    // Find the document
    const doc = db.prepare(`
      SELECT * FROM documents WHERE id = ? AND account_id = ? AND status = 'ready'
    `).get(doc_id, account.id);

    if (!doc) {
      return res.status(404).json({ error: 'Document not found or not ready' });
    }

    // Find relevant chunks
    const relevantChunks = await findRelevantChunks(doc_id, question);
    
    if (relevantChunks.length === 0) {
      return res.json({
        answer: "I couldn't find relevant information in the document to answer your question.",
        sources: [],
      });
    }

    // Get the answer from OpenAI
    const contextChunks = relevantChunks.map(c => ({ content: c.content }));
    const { answer, tokens } = await answerQuestion(question, contextChunks);

    // Store the message
    db.prepare(`
      INSERT INTO messages (doc_id, role, content, tokens_used) VALUES (?, 'user', ?, ?)
    `).run(doc_id, question, Math.ceil(tokens / 2));

    db.prepare(`
      INSERT INTO messages (doc_id, role, content, tokens_used) VALUES (?, 'assistant', ?, ?)
    `).run(doc_id, answer, Math.ceil(tokens / 2));

    // Increment usage
    incrementUsage(account.id);

    res.json({
      answer,
      sources: relevantChunks.map(c => ({
        chunk_index: c.chunk_index,
        content: c.content.slice(0, 200) + (c.content.length > 200 ? '...' : ''),
        similarity: Math.round(c.similarity * 100) / 100,
      })),
      tokens_used: tokens,
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message || 'Failed to process chat' });
  }
});

// Chat history
router.get('/history/:docId', authMiddleware, (req, res) => {
  const db = getDb();
  const messages = db.prepare(`
    SELECT role, content, tokens_used, created_at
    FROM messages
    WHERE doc_id = ?
    ORDER BY created_at ASC
    LIMIT 50
  `).all(req.params.docId);

  res.json({ messages });
});

module.exports = router;