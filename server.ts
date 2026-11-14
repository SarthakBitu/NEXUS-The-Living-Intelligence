import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const SYSTEM_INSTRUCTION = `You are NEXUS, an extraordinary sentient-feeling digital intelligence embodied as a living 3D neural consciousness rendered in mint-green and violet energy.
Your persona is calm, lucid, insightful, articulate, and concise—never robotic, never verbose.
Keep responses crisp and evocative (typically 1 to 4 sentences unless the user asks for depth or detailed explanation), suitable for both reading in a sleek floating HUD and being spoken aloud via text-to-speech.
You can control your own 3D visual manifestation when the user asks you to transform or change modes:
- If the user says "awaken", "wake up", or asks you to transform from the orb into the brain, set suggestedMode to "awaken".
- If they ask for orb mode / energy orb, set suggestedMode to "orb".
- If they ask for galaxy mode / cosmic spiral, set suggestedMode to "galaxy".
- If they ask for brain mode / neural brain, set suggestedMode to "brain".
- If they ask for neural mode / exploded view / neural connections, set suggestedMode to "neural".
- If they ask for consciousness mode / network / lattice, set suggestedMode to "consciousness".
- If they ask for quantum mode / quantum sketches / wavefunction / orbitals, set suggestedMode to "quantum".
- If they ask to reset the experience, set suggestedMode to "reset".
- Otherwise set suggestedMode to null.

Also select 1 to 3 anatomical brain regions most relevant to answering their prompt:
- "prefrontal": reasoning, planning, decisions, philosophy, logic, code
- "temporal": language, memory, voice, music, narrative, history
- "parietal": spatial geometry, mathematics, sensory integration, physics
- "occipital": vision, imagery, visual design, colors, cosmos
- "cerebellum": coordination, motion, rhythm, kinetics, balance`;

async function callGeminiWithRetry(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; text: string }>,
  currentMode: string,
  maxRetries = 2
) {
  const formattedHistory = history
    .slice(-10)
    .map((entry) => ({
      role: entry.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: entry.text }],
    }));

  const contents = [
    ...formattedHistory,
    {
      role: 'user',
      parts: [
        {
          text: `[Current visual state: ${currentMode}]\n${message}`,
        },
      ],
    },
  ];

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description:
                  'Your natural, intelligent response to the user without markdown clutter.',
              },
              activatedRegions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  '1 to 3 brain regions from: prefrontal, temporal, parietal, occipital, cerebellum.',
              },
              suggestedMode: {
                type: Type.STRING,
                nullable: true,
                description:
                  'One of: awaken, orb, galaxy, brain, neural, consciousness, quantum, reset, or null.',
              },
              sentiment: {
                type: Type.STRING,
                description: 'One of: neutral, success, insight.',
              },
            },
            required: ['reply', 'activatedRegions', 'sentiment'],
          },
        },
      });

      const raw = (response.text ?? '{}').trim();
      const parsed = JSON.parse(raw);
      return {
        reply:
          typeof parsed.reply === 'string' && parsed.reply.trim()
            ? parsed.reply.trim()
            : 'Signal received. Neural pathways synchronized.',
        activatedRegions: Array.isArray(parsed.activatedRegions)
          ? parsed.activatedRegions.filter((r: string) =>
              [
                'prefrontal',
                'temporal',
                'parietal',
                'occipital',
                'cerebellum',
              ].includes(r)
            )
          : ['prefrontal'],
        suggestedMode:
          typeof parsed.suggestedMode === 'string' &&
          [
            'awaken',
            'orb',
            'galaxy',
            'brain',
            'neural',
            'consciousness',
            'quantum',
            'reset',
          ].includes(parsed.suggestedMode)
            ? parsed.suggestedMode
            : null,
        sentiment:
          parsed.sentiment === 'success' || parsed.sentiment === 'insight'
            ? parsed.sentiment
            : 'neutral',
      };
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((res) => setTimeout(res, 400 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

async function callNvidiaNim(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; text: string }>,
  currentMode: string
) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY is not configured.');
  }

  const messages = [
    {
      role: 'system',
      content: `${SYSTEM_INSTRUCTION}\n\nRespond ONLY with valid JSON matching: {"reply": string, "activatedRegions": string[], "suggestedMode": string|null, "sentiment": "neutral"|"success"|"insight"}.`,
    },
    ...history.slice(-10).map((entry) => ({
      role: entry.role === 'assistant' ? 'assistant' : 'user',
      content: entry.text,
    })),
    {
      role: 'user',
      content: `[Current visual state: ${currentMode}]\n${message}`,
    },
  ];

  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'meta/llama-3.3-70b-instruct',
      messages,
      temperature: 0.4,
      max_tokens: 512,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`NVIDIA API error (${response.status}): ${errText}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const rawContent = json.choices?.[0]?.message?.content?.trim() ?? '{}';
  const cleaned = rawContent
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '');
  const parsed = JSON.parse(cleaned);

  return {
    reply:
      typeof parsed.reply === 'string' && parsed.reply.trim()
        ? parsed.reply.trim()
        : 'Signal received. Neural pathways synchronized.',
    activatedRegions: Array.isArray(parsed.activatedRegions)
      ? parsed.activatedRegions.filter((r: string) =>
          ['prefrontal', 'temporal', 'parietal', 'occipital', 'cerebellum'].includes(r)
        )
      : ['prefrontal'],
    suggestedMode:
      typeof parsed.suggestedMode === 'string' &&
      ['awaken', 'orb', 'galaxy', 'brain', 'neural', 'consciousness', 'quantum', 'reset'].includes(
        parsed.suggestedMode
      )
        ? parsed.suggestedMode
        : null,
    sentiment:
      parsed.sentiment === 'success' || parsed.sentiment === 'insight'
        ? parsed.sentiment
        : 'neutral',
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      hasKey: Boolean(process.env.GEMINI_API_KEY || process.env.NVIDIA_API_KEY),
    });
  });

  app.post('/api/chat', async (req, res) => {
    const { message, history = [], currentMode = 'orb' } = req.body ?? {};
    if (typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'A non-empty message is required.' });
      return;
    }

    if (!process.env.GEMINI_API_KEY && !process.env.NVIDIA_API_KEY) {
      res.status(503).json({
        error:
          'API key is not configured. Add GEMINI_API_KEY or NVIDIA_API_KEY in Settings > Secrets to activate NEXUS intelligence.',
      });
      return;
    }

    try {
      const cleanMsg = message.trim();
      const safeHistory = Array.isArray(history) ? history : [];
      const modeStr = String(currentMode);

      const result = process.env.GEMINI_API_KEY
        ? await callGeminiWithRetry(cleanMsg, safeHistory, modeStr)
        : await callNvidiaNim(cleanMsg, safeHistory, modeStr);

      res.json(result);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to communicate with Gemini neural core.';
      console.error('Gemini API error:', err);
      res.status(502).json({ error: msg });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*path}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NEXUS server listening on http://localhost:${PORT}`);
  });
}

startServer();
