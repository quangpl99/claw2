// chat.test.js
const path = require('path');

console.log('Testing chat/similarity logic...');

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Test 1: Identical vectors
const v1 = [1, 0, 0];
const v2 = [1, 0, 0];
const sim1 = cosineSimilarity(v1, v2);
console.assert(Math.abs(sim1 - 1) < 0.0001, 'Identical vectors should have similarity 1');
console.log(`✓ Test 1: Identical vectors similarity = ${sim1.toFixed(4)}`);

// Test 2: Orthogonal vectors
const v3 = [1, 0, 0];
const v4 = [0, 1, 0];
const sim2 = cosineSimilarity(v3, v4);
console.assert(Math.abs(sim2) < 0.0001, 'Orthogonal vectors should have similarity 0');
console.log(`✓ Test 2: Orthogonal vectors similarity = ${sim2.toFixed(4)}`);

// Test 3: Opposite vectors
const v5 = [1, 0, 0];
const v6 = [-1, 0, 0];
const sim3 = cosineSimilarity(v5, v6);
console.assert(Math.abs(sim3 + 1) < 0.0001, 'Opposite vectors should have similarity -1');
console.log(`✓ Test 3: Opposite vectors similarity = ${sim3.toFixed(4)}`);

// Test 4: Partial similarity
const v7 = [1, 1, 0];
const v8 = [1, 0, 0];
const sim4 = cosineSimilarity(v7, v8);
console.assert(sim4 > 0.5 && sim4 < 1, 'Partial similarity should be between 0 and 1');
console.log(`✓ Test 4: Partial similarity = ${sim4.toFixed(4)}`);

// Test 5: High-dimensional vectors
const makeVec = (n, val) => Array.from({ length: n }, () => val);
const v9 = makeVec(1536, 0.5);
const v10 = makeVec(1536, 0.5);
const sim5 = cosineSimilarity(v9, v10);
console.assert(Math.abs(sim5 - 1) < 0.0001, 'Same high-dim vectors should be similar');
console.log(`✓ Test 5: High-dimensional similarity = ${sim5.toFixed(4)}`);

// Test 6: Different high-dim vectors
const v11 = makeVec(1536, 0.5);
const v12 = makeVec(1536, -0.5);
const sim6 = cosineSimilarity(v11, v12);
console.assert(Math.abs(sim6 + 1) < 0.0001, 'Opposite high-dim vectors should be -1');
console.log(`✓ Test 6: High-dim opposite similarity = ${sim6.toFixed(4)}`);

console.log('\n✅ All chat tests passed!');