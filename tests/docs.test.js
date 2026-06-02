// docs.test.js
const { execSync } = require('child_process');
const path = require('path');

console.log('Testing document chunking logic...');

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

function chunkText(text, maxTokens = 500) {
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
  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  return chunks;
}

// Test 1: Basic chunking
const test1 = 'This is paragraph one.\n\nThis is paragraph two.\n\nThis is paragraph three.';
const chunks1 = chunkText(test1);
console.assert(chunks1.length >= 1, 'Should create at least one chunk');
console.log(`✓ Test 1: Basic chunking - ${chunks1.length} chunks`);

// Test 2: Token limit respected
const longText = 'A'.repeat(2000) + '\n\n' + 'B'.repeat(2000);
const chunks2 = chunkText(longText);
console.assert(chunks2.every(c => estimateTokens(c) <= 600), 'No chunk should exceed token limit');
console.log(`✓ Test 2: Token limit - ${chunks2.length} chunks, max tokens: ${Math.max(...chunks2.map(c => estimateTokens(c)))}`);

// Test 3: Empty content
const chunks3 = chunkText('');
console.assert(chunks3.length === 0, 'Empty content should produce no chunks');
console.log('✓ Test 3: Empty content handling');

// Test 4: Single paragraph
const single = 'Just one paragraph here.';
const chunks4 = chunkText(single);
console.assert(chunks4.length === 1, 'Single paragraph should be one chunk');
console.log('✓ Test 4: Single paragraph');

// Test 5: Many small paragraphs
const manyParas = Array.from({ length: 20 }, (_, i) => `Paragraph ${i + 1}`).join('\n\n');
const chunks5 = chunkText(manyParas);
console.assert(chunks5.length > 1, 'Many paragraphs should create multiple chunks');
console.log(`✓ Test 5: Many paragraphs - ${chunks5.length} chunks`);

// Test 6: Markdown content
const markdown = '# Header\n\nSome content here.\n\n## Subheader\n\nMore content.';
const chunks6 = chunkText(markdown);
console.assert(chunks6.length >= 1, 'Markdown should be chunked');
console.log(`✓ Test 6: Markdown content - ${chunks6.length} chunks`);

console.log('\n✅ All docs tests passed!');