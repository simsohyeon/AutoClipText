#!/usr/bin/env bash
# Oracle Cloud Ubuntu(ARM/x86) VM 에서 한 번 실행하는 셋업 스크립트.
# 프로젝트 폴더 안에서:  bash deploy/setup-server.sh
set -e

echo "==> Node.js 22 LTS 설치"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v

echo "==> pm2 설치"
sudo npm install -g pm2

echo "==> 의존성 설치"
npm ci || npm install

echo "==> .env 확인"
if [ ! -f .env ]; then
  echo "!! .env 가 없습니다. 먼저 .env 를 만들고 다시 실행하세요. (.env.example 참고)"
  exit 1
fi

echo "==> 봇 시작 (pm2)"
pm2 start ecosystem.config.js
pm2 save

echo "==> 서버 재부팅 후 자동 실행 등록"
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u "$USER" --hp "$HOME" | tail -1 | bash || true
pm2 save

echo ""
echo "==> 완료! 상태 확인:  pm2 status"
echo "    로그 보기:       pm2 logs autoblog-bot"
