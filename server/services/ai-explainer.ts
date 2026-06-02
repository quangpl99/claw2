import OpenAI from 'openai';
import { prisma } from '../db/client.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function explainError(
  groupId: string,
  errorType: string,
  message: string,
  stack: string
): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.log('AI explainer: no API key, skipping');
    return null;
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `You are a senior developer explaining errors to indie hackers. 
Keep explanations short (3 sentences max). 
Format: "What happened: [explanation]. Most likely cause: [cause]. Suggested fix: [fix]."
No markdown. Plain text only.`
        },
        {
          role: 'user',
          content: `Explain this error for an indie developer:

Type: ${errorType}
Message: ${message}
Stack:\n${stack.substring(0, 2000)}`
        }
      ]
    });

    const explanation = response.choices[0].message.content;
    
    await prisma.errorGroup.update({
      where: { id: groupId },
      data: {
        aiExplanation: explanation,
        aiRequestedAt: new Date(),
      }
    });

    return explanation;
  } catch (err) {
    console.error('AI explainer error:', err);
    return null;
  }
}