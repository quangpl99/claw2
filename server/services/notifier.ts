interface ErrorGroup {
  id: string;
  type: string;
  message: string;
  file: string | null;
  line: number | null;
  aiExplanation: string | null;
  resolved: boolean;
}

export async function sendNotification(
  webhookUrl: string,
  platform: string,
  group: ErrorGroup,
  errorUrl: string
): Promise<void> {
  const errorLocation = group.file 
    ? `${group.file}${group.line ? `:${group.line}` : ''}`
    : 'unknown location';

  // AI explanation to include
  const aiHint = group.aiExplanation 
    ? `\n💡 AI: ${group.aiExplanation}` 
    : '';

  // Build notification payload
  const payload = platform === 'slack' 
    ? buildSlackPayload(group, errorLocation, aiHint, errorUrl)
    : buildDiscordPayload(group, errorLocation, aiHint, errorUrl);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Webhook returned ${response.status}: ${text}`);
    }
  } catch (err) {
    console.error(`Failed to send ${platform} notification:`, err);
  }
}

function buildSlackPayload(group: ErrorGroup, location: string, aiHint: string, url: string) {
  return {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🚨 ShipFast Logs — New Error' }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Type:*\n${group.type}` },
          { type: 'mrkdwn', text: `*Location:*\n${location}` }
        ]
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Message:*\n\`${group.message.substring(0, 200)}\`` }
      },
      ...(aiHint ? [{
        type: 'section',
        text: { type: 'mrkdwn', text: aiHint }
      }] : []),
      {
        type: 'actions',
        elements: [{
          type: 'button',
          text: { type: 'plain_text', text: 'View Full Error' },
          url: url
        }]
      }
    ]
  };
}

function buildDiscordPayload(group: ErrorGroup, location: string, aiHint: string, url: string) {
  return {
    embeds: [{
      title: `🚨 Error: ${group.type}`,
      color: 0xF85149, // Red
      fields: [
        { name: 'Message', value: group.message.substring(0, 200), inline: false },
        { name: 'Location', value: location, inline: true },
        ...(group.aiExplanation ? [
          { name: '💡 AI Insight', value: group.aiExplanation, inline: false }
        ] : []),
      ],
      url,
      footer: { text: 'ShipFast Logs' },
      timestamp: new Date().toISOString(),
    }]
  };
}

export async function testWebhook(webhookUrl: string, platform: string): Promise<{ success: boolean; message: string }> {
  const payload = platform === 'slack' 
    ? { text: '✅ ShipFast Logs: Webhook test successful!' }
    : {
        embeds: [{
          title: '✅ ShipFast Logs: Webhook Connected!',
          description: 'You\'ll receive error notifications here.',
          color: 0x7EE787,
          footer: { text: 'ShipFast Logs' },
          timestamp: new Date().toISOString(),
        }]
      };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    return { success: true, message: 'Webhook test successful!' };
  } else {
    const text = await response.text();
    return { success: false, message: `Webhook test failed: ${response.status} ${text}` };
  }
}