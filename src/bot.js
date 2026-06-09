'use strict';

const http = require('http');
const { Telegraf } = require('telegraf');
const config = require('./config');
const store = require('./session');
const { generateContent, buildCaption } = require('./content/generate');

if (!config.telegram.token) {
  console.error('TELEGRAM_BOT_TOKEN 이 없습니다 (.env 확인).');
  process.exit(1);
}

const bot = new Telegraf(config.telegram.token);

function isAllowed(ctx) {
  const ids = config.telegram.allowedUserIds;
  if (!ids.length) return true;
  return ids.includes(ctx.from && ctx.from.id);
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function downloadBuffer(ctx, fileId) {
  const link = await ctx.telegram.getFileLink(fileId);
  const res = await fetch(link.href);
  if (!res.ok) throw new Error('파일 다운로드 실패: ' + res.status);
  return Buffer.from(await res.arrayBuffer());
}

bot.start((ctx) =>
  ctx.reply(
    '안녕하세요! 사진과 장소 이름을 보내주세요. 📸\n\n' +
      '· 사진을 보내면서 캡션에 장소 이름을 적거나\n' +
      '· 사진을 먼저 보내고 장소 이름을 텍스트로 보내도 됩니다.\n\n' +
      '그러면 네이버 클립 게시물용 글 + 해시태그를 만들어드려요.\n' +
      '완성된 글 박스를 탭하면 복사돼요. 클립 앱에서 사진 고르고 붙여넣어 게시하면 끝! 🚀'
  )
);

// 사진 수신
bot.on('photo', async (ctx) => {
  if (!isAllowed(ctx)) return;
  const chatId = ctx.chat.id;
  const photos = ctx.message.photo;
  const best = photos[photos.length - 1]; // 가장 큰 해상도
  try {
    const buffer = await downloadBuffer(ctx, best.file_id);
    store.addPhoto(chatId, { buffer, mime: 'image/jpeg' });
    if (ctx.message.caption) store.setPlace(chatId, ctx.message.caption.trim());
    scheduleProcess(ctx, chatId);
  } catch (e) {
    console.error(e);
    ctx.reply('사진을 받는 중 오류가 났어요: ' + e.message);
  }
});

// 텍스트 = 장소 이름(또는 추가 메모)
bot.on('text', async (ctx) => {
  if (!isAllowed(ctx)) return;
  const chatId = ctx.chat.id;
  const text = ctx.message.text.trim();
  if (text.startsWith('/')) return;
  const s = store.get(chatId);
  if (!s.placeName) store.setPlace(chatId, text);
  else store.setNote(chatId, text);
  scheduleProcess(ctx, chatId);
});

function scheduleProcess(ctx, chatId) {
  store.schedule(chatId, config.groupDebounceMs, () => process_(ctx, chatId));
}

async function process_(ctx, chatId) {
  const s = store.get(chatId);
  if (!s.photos.length) return ctx.reply('사진을 한 장 이상 보내주세요.');
  if (!s.placeName) return ctx.reply('장소 이름을 알려주세요. (예: "연남동 OOO 카페")');

  const job = {
    placeName: s.placeName,
    note: s.note,
    images: s.photos.map((p) => ({ buffer: p.buffer, mime: p.mime })),
  };
  store.clear(chatId);
  store.saveLast(chatId, job);

  await ctx.reply(`"${job.placeName}" 글을 쓰는 중... ✍️`);
  await sendResult(ctx, job);
}

async function sendResult(ctx, job, extraInstruction) {
  try {
    const content = await generateContent({ ...job, extraInstruction });
    const caption = buildCaption(content);

    await ctx.reply(
      `✅ <b>${escapeHtml(job.placeName)}</b> 게시물 글이에요.\n` +
        `아래 박스를 탭하면 전체가 복사됩니다 👇\n\n` +
        `<pre>${escapeHtml(caption)}</pre>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '🔄 다른 느낌으로 다시', callback_data: 'regen' }]],
        },
      }
    );
  } catch (e) {
    console.error(e);
    await ctx.reply('글 생성 중 오류가 났어요: ' + e.message);
  }
}

bot.on('callback_query', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const data = ctx.callbackQuery.data || '';
  if (data === 'regen') {
    const chatId = ctx.chat.id;
    const job = store.getLast(chatId);
    if (!job) return ctx.reply('다시 만들 글이 없어요. 사진과 장소를 다시 보내주세요.');
    await ctx.reply('다른 느낌으로 다시 쓰는 중... 🔄');
    await sendResult(ctx, job, '이전과 다른 어휘와 분위기로, 새로운 버전으로 작성해줘.');
  }
});

// 클라우드(PaaS) 헬스체크용 최소 HTTP 서버.
// 폴링 봇은 포트를 열지 않아서, 포트 응답이 없으면 Koyeb/Render 가 인스턴스를 죽인다.
// 그래서 PORT 에 200 만 돌려주는 가벼운 서버를 함께 띄운다.
const port = process.env.PORT || 8000;
http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('AutoClip bot is running');
  })
  .listen(port, () => console.log('헬스체크 서버 포트:', port));

// Telegraf v4 의 launch() 는 "봇이 멈출 때" resolve 되므로, 시작 로그는 별도로 찍는다.
bot.launch().catch((err) => {
  console.error('봇 실행 실패:', err.message);
  process.exit(1);
});
console.log('AutoBlog 봇 실행 중... (Ctrl+C 로 종료)');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
