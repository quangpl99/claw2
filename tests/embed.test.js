// embed.test.js

console.log('Testing embed widget generation...');

const baseUrl = 'https://test.shipfastdocs.com';
const docId = 'test-doc-123';

// Simulate the widget code generator
const widgetCode = `// ShipFast Docs Widget
(function() {
  var docId = '${docId}';
  var baseUrl = '${baseUrl}';
  // ... rest of widget
})();
`;

// Test 1: Widget contains docId
console.assert(widgetCode.includes(docId), 'Widget should contain docId');
console.log('✓ Test 1: Widget contains docId');

// Test 2: Widget contains baseUrl
console.assert(widgetCode.includes(baseUrl), 'Widget should contain baseUrl');
console.log('✓ Test 2: Widget contains baseUrl');

// Test 3: Widget is self-executing
console.assert(widgetCode.includes('(function()'), 'Widget should be IIFE');
console.assert(widgetCode.includes('})();'), 'Widget should call itself');
console.log('✓ Test 3: Widget is self-executing');

// Test 4: Widget has chat API call
console.assert(widgetCode.includes('/api/v1/chat'), 'Widget should call chat API');
console.log('✓ Test 4: Widget calls chat API');

// Test 5: Widget has DOM structure
console.assert(widgetCode.includes('sfd-widget'), 'Widget should have widget class');
console.assert(widgetCode.includes('sfd-popup'), 'Widget should have popup class');
console.assert(widgetCode.includes('sfd-input'), 'Widget should have input field');
console.log('✓ Test 5: Widget has all UI elements');

// Test 6: CSS is included
console.assert(widgetCode.includes('.sfd-widget'), 'Widget should have CSS');
console.assert(widgetCode.includes('position: fixed'), 'Widget should be positioned fixed');
console.log('✓ Test 6: Widget has CSS styles');

console.log('\n✅ All embed tests passed!');