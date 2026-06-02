// Test runner
const { execSync } = require('child_process');
const path = require('path');

const tests = [
  { name: 'docs.test.js', file: path.join(__dirname, 'docs.test.js') },
  { name: 'chat.test.js', file: path.join(__dirname, 'chat.test.js') },
  { name: 'embed.test.js', file: path.join(__dirname, 'embed.test.js') },
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    console.log(`\n▶ Running ${test.name}`);
    execSync(`node ${test.file}`, { stdio: 'inherit' });
    passed++;
  } catch (err) {
    console.error(`✖ ${test.name} failed`);
    failed++;
  }
}

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);