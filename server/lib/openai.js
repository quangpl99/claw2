const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = 'gpt-4o';
const EMBED_MODEL = 'text-embedding-3-small';
const EMBED_DIMENSIONS = 1536;

// Embed text into a vector
async function embedText(text) {
  const response = await openai.embeddings.create({
    model: EMBED_MODEL,
    input: text,
    dimensions: EMBED_DIMENSIONS,
  });
  return response.data[0].embedding;
}

// Convert embedding array to base64 for storage
function embeddingToBase64(embedding) {
  const arr = new Float32Array(embedding);
  const buf = Buffer.from(arr);
  return buf.toString('base64');
}

// Convert base64 back to embedding array
function base64ToEmbedding(base64) {
  const buf = Buffer.from(base64, 'base64');
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4).toArray();
}

// Compute cosine similarity between two vectors
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Answer a question given context chunks
async function answerQuestion(question, contextChunks, systemPrompt = null) {
  const contextText = contextChunks
    .map((c, i) => `[Source ${i + 1}]:\n${c.content}`)
    .join('\n\n');

  const defaultSystem = `You are a helpful assistant answering questions based ONLY on the provided sources. If the answer is not in the sources, say "I don't have that information in the provided documentation." Do not make up information. Format your response clearly.`;

  const messages = [
    { role: 'system', content: systemPrompt || defaultSystem },
    { role: 'user', content: `Sources:\n${contextText}\n\nQuestion: ${question}` },
  ];

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.3,
    max_tokens: 1000,
  });

  return {
    answer: response.choices[0].message.content,
    tokens: response.usage.total_tokens,
    model: MODEL,
  };
}

// Count tokens (rough estimate for chunking)
function estimateTokens(text) {
  // Rough estimate: ~4 chars per token for English
  return Math.ceil(text.length / 4);
}

module.exports = {
  embedText,
  embeddingToBase64,
  base64ToEmbedding,
  cosineSimilarity,
  answerQuestion,
  estimateTokens,
  MODEL,
  EMBED_MODEL,
};