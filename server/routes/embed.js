const express = require('express');
const router = express.Router();

// Get embed snippet for a document
router.get('/:docId.js', (req, res) => {
  const { docId } = req.params;
  const baseUrl = process.env.BASE_URL || `https://${req.hostname}`;

  const widgetCode = `// ShipFast Docs Widget
(function() {
  var docId = '${docId}';
  var baseUrl = '${baseUrl}';
  var container = null;
  var apiKey = null;

  // Create widget styles
  var style = document.createElement('style');
  style.textContent = \`
    .sfd-widget {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .sfd-btn {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .sfd-btn:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 25px rgba(102, 126, 234, 0.6);
    }
    .sfd-popup {
      display: none;
      position: absolute;
      bottom: 70px;
      right: 0;
      width: 380px;
      max-height: 500px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.15);
      overflow: hidden;
      flex-direction: column;
    }
    .sfd-popup.open { display: flex; }
    .sfd-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 20px;
      font-weight: 600;
      font-size: 16px;
    }
    .sfd-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      max-height: 300px;
    }
    .sfd-input-row {
      display: flex;
      gap: 8px;
      padding: 12px;
      border-top: 1px solid #eee;
    }
    .sfd-input {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
    }
    .sfd-input:focus { border-color: #667eea; }
    .sfd-send {
      padding: 10px 16px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
    }
    .sfd-send:hover { background: #764ba2; }
    .sfd-message { margin-bottom: 12px; padding: 10px 14px; border-radius: 12px; line-height: 1.5; font-size: 14px; }
    .sfd-message.user { background: #f0f0f0; margin-left: 20px; }
    .sfd-message.assistant { background: #e8e5ff; margin-right: 20px; }
    .sfd-source { font-size: 11px; color: #888; margin-top: 4px; }
    .sfd-loading { text-align: center; padding: 20px; color: #888; }
    .sfd-error { color: #e74c3c; padding: 10px; text-align: center; font-size: 13px; }
    .sfd-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #e74c3c;
      color: white;
      font-size: 10px;
      padding: 3px 6px;
      border-radius: 10px;
    }
  \`;
  document.head.appendChild(style);

  // Create widget HTML
  var widget = document.createElement('div');
  widget.className = 'sfd-widget';
  widget.innerHTML = \`
    <div class="sfd-popup" id="sfd-popup">
      <div class="sfd-header">⚡ ShipFast Docs AI</div>
      <div class="sfd-body" id="sfd-body">
        <div style="text-align:center;color:#888;padding:30px;">
          Ask me anything about this documentation
        </div>
      </div>
      <div class="sfd-input-row">
        <input class="sfd-input" id="sfd-input" placeholder="Ask a question..." autocomplete="off" />
        <button class="sfd-send" id="sfd-send">Send</button>
      </div>
    </div>
    <button class="sfd-btn" id="sfd-btn">💬<span class="sfd-badge" id="sfd-badge" style="display:none;">1</span></button>
  \`;
  document.body.appendChild(widget);

  var popup = document.getElementById('sfd-popup');
  var btn = document.getElementById('sfd-btn');
  var body = document.getElementById('sfd-body');
  var input = document.getElementById('sfd-input');
  var sendBtn = document.getElementById('sfd-send');

  btn.onclick = function() {
    popup.classList.toggle('open');
    if (popup.classList.contains('open')) input.focus();
  };

  function sendMessage() {
    var question = input.value.trim();
    if (!question) return;

    // Add user message
    var userMsg = document.createElement('div');
    userMsg.className = 'sfd-message user';
    userMsg.textContent = question;
    body.appendChild(userMsg);
    input.value = '';

    // Show loading
    var loading = document.createElement('div');
    loading.className = 'sfd-loading';
    loading.textContent = 'Thinking...';
    body.appendChild(loading);
    scrollBottom();

    // Call API
    fetch(baseUrl + '/api/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question, doc_id: docId })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      body.removeChild(loading);
      var msg = document.createElement('div');
      msg.className = 'sfd-message assistant';
      msg.innerHTML = '<div>' + data.answer + '</div>';
      if (data.sources && data.sources.length > 0) {
        msg.innerHTML += '<div class="sfd-source">📄 Source: ' + data.sources[0].chunk_index + '</div>';
      }
      body.appendChild(msg);
      scrollBottom();
    })
    .catch(function(err) {
      body.removeChild(loading);
      var errMsg = document.createElement('div');
      errMsg.className = 'sfd-error';
      errMsg.textContent = 'Error: ' + err.message;
      body.appendChild(errMsg);
    });
  }

  function scrollBottom() {
    body.scrollTop = body.scrollHeight;
  }

  sendBtn.onclick = sendMessage;
  input.onkeypress = function(e) {
    if (e.key === 'Enter') sendMessage();
  };
})();
  `;

  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(widgetCode);
});

module.exports = router;