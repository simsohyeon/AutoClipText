# AutoClip 봇 컨테이너 이미지 (Koyeb / Render / 기타 PaaS 공용)
FROM node:22-slim

WORKDIR /app

# 의존성 먼저 설치 (캐시 활용)
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# 소스 복사
COPY . .

# 헬스체크 포트 (Koyeb 가 PORT 환경변수를 주입함)
ENV PORT=8000
EXPOSE 8000

CMD ["node", "src/bot.js"]
