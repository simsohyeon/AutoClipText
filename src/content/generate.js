'use strict';

const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');
const config = require('../config');

// 작성자 본인 글 샘플을 읽어온다(매 호출 시 읽으므로 파일만 고치면 즉시 반영, 봇 재시작 불필요).
function loadStyleSamples() {
  try {
    const txt = fs.readFileSync(config.stylePath, 'utf8').trim();
    // 주석(#로 시작) 줄과 빈 내용 제거
    const cleaned = txt
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n')
      .trim();
    return cleaned.length > 10 ? cleaned : '';
  } catch (_) {
    return '';
  }
}

function buildSystemPrompt() {
  const samples = loadStyleSamples();
  if (!samples) return SYSTEM_PROMPT;
  return (
    SYSTEM_PROMPT +
    `\n\n[작성자 기존 글 스타일 — 매우 중요]\n` +
    `아래는 이 계정 운영자가 직접 쓴 기존 글들이다. 어휘 선택, 말투(반말/존댓말), ` +
    `문장 길이와 호흡, 줄바꿈·이모지 사용 빈도, 해시태그 개수와 스타일을 ` +
    `이 예시들과 최대한 비슷하게 맞춰라. 내용은 이번 사진/장소에 맞게 새로 쓰되 "목소리"는 똑같이.\n\n` +
    `<예시 글들>\n${samples}\n</예시 글들>`
  );
}

// 사진(여러 장)을 Gemini 에게 함께 보여줘서 메뉴/분위기까지 반영한 글을 생성한다.
// 입력:  { placeName, note, images: [{ buffer, mime }], extraInstruction }
// 출력:  { title, body, hashtags: string[] }

const SYSTEM_PROMPT = `너는 네이버 클립(숏폼)에 올릴 한국어 맛집/카페 소개 글을 쓰는 카피라이터다.
말투는 친근하고 들뜬 존댓말(요체), 의미 있는 이모지를 적극 사용한다.

[title — 첫 줄 후킹 (가장 중요)]
- 스크롤을 멈추게 하는 강력한 한 줄. 호기심/감탄/혜택을 자극한다.
- 예: "OO에서 이건 무조건 먹어야 해요!", "여기 분위기 실화..? 🦁"
- 장소명을 자연스럽게 녹이되 밋밋한 정보 나열은 금지.

[body — 본문]
- 첫 줄 아래 한두 문장으로 생생한 도입. 그다음 구조화된 정보.
- 메뉴는 "🍞 메뉴명" 줄 + 감각적 묘사(겉바속촉, 상큼하고 깊은 국물 등)로 소개하거나,
  "✔️ 가격 / ✔️ 분위기 / ✔️ 특징 / ✔️ 팁" 형태로 정리한다(사진·메모에 맞는 형식 선택).
- 누구와 가기 좋은지(데이트/혼밥/모임)를 한 줄 넣는다.
- 본문 끝에 정보 푸터:
  📌 (장소명)
  📍 (주소)
  💡 (팁 — 예: 웨이팅/예약/영업시간)
- 마지막에 CTA 한 줄. 예: "☘️ 더 많은 핫플·데이트 코스가 궁금하다면 팔로우!"

[사실 관계 — 절대 규칙]
- 사진에 보이거나 '추가 메모'로 주어진 사실만 쓴다. 사진에 없는 메뉴/사실을 지어내지 않는다.
- 가격·주소·영업시간처럼 확인되지 않은 정보는 절대 추측하지 말고, 그 자리에 정확히 "(직접 입력)" 이라고 비워둔다.
  (예: 메모에 주소가 없으면 → 📍 (직접 입력))

[hashtags]
- 6~10개. 지역/장소명/메뉴/상황(데이트·감성·맛집) 키워드를 섞는다. '#' 포함.

반드시 아래 JSON 형식 하나만 출력한다. 다른 말은 절대 붙이지 않는다.
{"title": "...", "body": "...", "hashtags": ["#...", "#..."]}`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    body: { type: 'string' },
    hashtags: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'body', 'hashtags'],
};

// Gemini 무료 티어는 일시적 503(혼잡)/429(레이트리밋)가 잦다. 지수 백오프로 재시도.
async function withRetry(fn, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = String(e && e.message);
      const transient = /503|UNAVAILABLE|429|RESOURCE_EXHAUSTED|overloaded|high demand/i.test(msg);
      if (!transient || i === tries - 1) throw e;
      const wait = 1500 * Math.pow(2, i); // 1.5s, 3s, 6s
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

function extractJson(text) {
  // responseMimeType=json 이면 보통 순수 JSON 이지만, 혹시 모를 잡소리에 대비.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('Gemini 응답에서 JSON 을 찾지 못했습니다: ' + text.slice(0, 200));
  }
  return JSON.parse(raw.slice(start, end + 1));
}

async function generateContent({ placeName, note, images = [], extraInstruction }) {
  if (!config.gemini.apiKey) {
    throw new Error('GEMINI_API_KEY 가 설정되지 않았습니다 (.env 확인).');
  }
  const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

  const parts = [];
  // 비전 입력은 최대 4장까지만 (토큰/비용 절약)
  for (const img of images.slice(0, 4)) {
    parts.push({
      inlineData: {
        mimeType: img.mime || 'image/jpeg',
        data: img.buffer.toString('base64'),
      },
    });
  }
  parts.push({
    text:
      `장소 이름: ${placeName}\n` +
      (note ? `추가 메모: ${note}\n` : '') +
      (extraInstruction ? `추가 요청: ${extraInstruction}\n` : '') +
      `위 사진들을 보고 이 장소를 소개하는 네이버 클립 글을 JSON 으로 작성해줘.`,
  });

  const resp = await withRetry(() =>
    ai.models.generateContent({
      model: config.gemini.model,
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction: buildSystemPrompt(),
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        maxOutputTokens: 1500,
        temperature: 0.9,
      },
    })
  );

  const text = resp.text || '';
  const parsed = extractJson(text);
  return {
    title: String(parsed.title || placeName).trim(),
    body: String(parsed.body || '').trim(),
    hashtags: Array.isArray(parsed.hashtags)
      ? parsed.hashtags.map((h) => String(h).trim()).filter(Boolean)
      : [],
  };
}

// 클립 게시물에 그대로 붙여넣을 최종 텍스트 (제목 + 본문 + 해시태그)
function buildCaption({ title, body, hashtags }) {
  const tags = (hashtags || []).join(' ');
  return [title, '', body, '', tags]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = { generateContent, buildCaption };
