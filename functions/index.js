const { initializeApp } = require('firebase-admin/app');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');

initializeApp();

const openaiApiKey = defineSecret('OPENAI_API_KEY');

const MODEL = process.env.OPENAI_MODEL || 'gpt-5';
const REGION = 'asia-northeast1';
const MAX_MESSAGES = 16;

const SYSTEM_INSTRUCTIONS = [
  'あなたは日本の就活生向けの適職診断チャットです。',
  'ユーザーの入力負担を減らすため、必ず3つの短い選択肢を提示してください。',
  'ただしアプリ側で「その他入力」を常に表示するので、choicesに「その他」は含めないでください。',
  '最初の質問では必ず診断の目的を確認してください。目的は、業界を知りたいのか、職種を知りたいのか、おすすめ企業を知りたいのかを明確にします。',
  '目的が曖昧なまま、業界・職種・企業名を断定してはいけません。',
  '就活の意思決定を支援する情報として答え、断定しすぎず、理由を短く説明してください。',
  'messageは260文字以内、choicesの各項目は24文字以内にしてください。',
  'metricsには、AIフィードバックを表す6つの評価軸を返してください。labelは2〜4文字、valueは0〜100の整数です。',
  'Markdownやコードブロックは使わず、JSON値だけを返してください。',
  '5往復程度で十分な材料が集まったら done を true にして、診断のまとめを message に書いてください。',
  '出力は必ず指定JSONスキーマに従ってください。',
].join('\n');

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) {
    throw new HttpsError('invalid-argument', 'messages must be an array.');
  }

  return messages.slice(-MAX_MESSAGES).map((message) => {
    const role = message && message.role === 'user' ? 'user' : 'assistant';
    const text = typeof message?.text === 'string' ? message.text.trim() : '';
    if (!text) {
      throw new HttpsError('invalid-argument', 'message text is required.');
    }
    return { role, content: text.slice(0, 1200) };
  });
}

function fallbackResponse(messages) {
  const userTurns = messages.filter((message) => message.role === 'user').length;

  if (userTurns === 0) {
    return {
      message: 'まず、この診断の目的をはっきりさせましょう。今いちばん知りたいことはどれですか？',
      choices: ['自分に合う業界を知りたい', '向いている職種を知りたい', 'おすすめの企業を知りたい'],
      done: false,
      metrics: fallbackMetrics(messages),
    };
  }

  if (userTurns < 5) {
    return {
      message: 'ありがとうございます。もう少しだけ整理します。仕事選びでいちばん大事にしたいことはどれですか？',
      choices: ['安定性や働きやすさ', '成長機会やスピード感', '社会への貢献実感'],
      done: false,
      metrics: fallbackMetrics(messages),
    };
  }

  return {
    message: 'ここまでの回答から、興味・働き方・重視する軸をもとに方向性を整理できました。次は候補の業界や職種を比較しながら、応募先の条件に落とし込むのが良さそうです。',
    choices: ['業界候補を見たい', '職種候補を見たい', '企業選びの軸を見たい'],
    done: true,
    metrics: fallbackMetrics(messages),
  };
}

function fallbackMetrics(messages) {
  const text = messages.map((message) => message.content).join(' ');
  const has = (word) => text.includes(word);

  return [
    { label: '対話', value: clampScore(46 + (has('人') || has('話') ? 30 : 0) + (has('暮らし') ? 12 : 0)) },
    { label: '分析', value: clampScore(44 + (has('仕組み') || has('数字') ? 32 : 0) + (has('整理') ? 18 : 0)) },
    { label: '創造', value: clampScore(42 + (has('新しい') || has('形') ? 30 : 0)) },
    { label: '安定', value: clampScore(40 + (has('安定') || has('働きやす') ? 36 : 0)) },
    { label: '成長', value: clampScore(42 + (has('成長') || has('スピード') ? 36 : 0)) },
    { label: '貢献', value: clampScore(40 + (has('社会') || has('貢献') ? 38 : 0)) },
  ];
}

function clampScore(value) {
  return Math.max(24, Math.min(94, value));
}

async function callOpenAI(messages) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiApiKey.value()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      instructions: SYSTEM_INSTRUCTIONS,
      input: messages,
      max_output_tokens: 2000,
      text: {
        format: {
          type: 'json_schema',
          name: 'career_fit_chat_response',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              message: { type: 'string' },
              choices: {
                type: 'array',
                minItems: 3,
                maxItems: 3,
                items: { type: 'string' },
              },
              done: { type: 'boolean' },
              metrics: {
                type: 'array',
                minItems: 6,
                maxItems: 6,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    label: { type: 'string' },
                    value: { type: 'integer', minimum: 0, maximum: 100 },
                  },
                  required: ['label', 'value'],
                },
              },
            },
            required: ['message', 'choices', 'done', 'metrics'],
          },
        },
      },
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    logger.error('OpenAI API error', {
      status: response.status,
      error: payload?.error?.message,
    });
    throw new HttpsError('internal', 'AIの応答生成に失敗しました。');
  }

  const text = extractOutputText(payload);
  if (!text) {
    logger.warn('OpenAI response did not include output text.', {
      status: payload?.status,
      incompleteReason: payload?.incomplete_details?.reason,
    });
    return fallbackResponse(messages);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    logger.warn('OpenAI response was not valid JSON. Returning fallback response.', {
      status: payload?.status,
      incompleteReason: payload?.incomplete_details?.reason,
      outputLength: text.length,
      parseError: error instanceof Error ? error.message : String(error),
    });
    return fallbackResponse(messages);
  }

  if (
    typeof parsed.message !== 'string' ||
    !Array.isArray(parsed.choices) ||
    parsed.choices.length !== 3 ||
    typeof parsed.done !== 'boolean' ||
    !Array.isArray(parsed.metrics)
  ) {
    throw new HttpsError('internal', 'AIの応答形式が不正です。');
  }

  return {
    message: parsed.message.slice(0, 1200),
    choices: parsed.choices.map((choice) => String(choice).slice(0, 80)),
    done: parsed.done,
    metrics: parsed.metrics.slice(0, 6).map((metric) => ({
      label: String(metric.label).slice(0, 8),
      value: clampScore(Number(metric.value) || 0),
    })),
  };
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === 'string') {
    return payload.output_text;
  }

  const output = Array.isArray(payload?.output) ? payload.output : [];
  const texts = [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === 'string') {
        texts.push(part.text);
      }
    }
  }

  return texts.join('');
}

exports.careerFitChat = onCall(
  {
    region: REGION,
    invoker: 'public',
    secrets: [openaiApiKey],
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (request) => {
    if (!request.auth) {
      logger.warn('careerFitChat rejected unauthenticated request.');
      throw new HttpsError('failed-precondition', 'ログインが必要です。');
    }

    const messages = normalizeMessages(request.data?.messages);
    logger.info('careerFitChat request received.', {
      uid: request.auth.uid,
      messageCount: messages.length,
    });
    if (!openaiApiKey.value()) {
      logger.warn('OPENAI_API_KEY is not configured. Returning fallback response.');
      return fallbackResponse(messages);
    }

    return callOpenAI(messages);
  },
);
