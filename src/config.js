'use strict';

require('dotenv').config();

function intList(v) {
  if (!v) return [];
  return String(v)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => !Number.isNaN(n));
}

const config = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
    allowedUserIds: intList(process.env.ALLOWED_TELEGRAM_USER_IDS),
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  },

  // 작성자 본인 글 스타일 샘플 파일 (있으면 그 말투를 따라 씀)
  stylePath:
    process.env.STYLE_SAMPLES_PATH ||
    require('path').join(__dirname, '..', 'data', 'style-samples.txt'),

  groupDebounceMs: Number(process.env.GROUP_DEBOUNCE_MS || 3000),
};

module.exports = config;
