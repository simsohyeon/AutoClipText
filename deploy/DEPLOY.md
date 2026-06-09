# Oracle Cloud 평생 무료 VM 에 봇 배포하기

한 번 세팅하면 PC를 꺼도 봇이 24시간 돌아갑니다. (평생 무료, 과금 없음)

> 폴링 방식 봇이라 **외부에서 들어오는 포트가 필요 없습니다.** 서버는 텔레그램·Gemini로
> 나가는 연결만 쓰므로 방화벽/포트 설정을 건드릴 필요가 없어요. 보안상으로도 간단합니다.

---

## 0. 준비물

- 신용/체크카드 1장 (Oracle 본인 인증용 — **과금되지 않습니다**. Always Free 범위만 씀)
- 이메일

---

## 1. Oracle Cloud 계정 + 무료 VM 만들기

1. https://www.oracle.com/kr/cloud/free/ → **무료로 시작하기** → 가입 (카드 인증 포함)
2. 콘솔 로그인 → 좌측 메뉴 **Compute > 인스턴스 > 인스턴스 생성**
3. 설정:
   - **이미지**: Canonical **Ubuntu 22.04** (또는 24.04)
   - **Shape(형상)**: **Ampere (ARM, VM.Standard.A1.Flex)** 선택 → OCPU 1, 메모리 6GB 정도면 충분 (Always Free 범위)
     - ⚠️ ARM 용량이 "out of capacity" 로 막히면, 다른 가용 도메인(AD-1/2/3)으로 바꾸거나
       잠시 후 재시도하세요. 정 안 되면 **VM.Standard.E2.1.Micro(x86)** Always Free 도 됩니다.
   - **SSH 키**: 아래 2번에서 만든 **공개키**를 붙여넣기 (또는 "키 쌍 생성" 후 개인키 다운로드)
4. **생성** → 잠시 후 인스턴스의 **공용 IP 주소**를 메모 (예: `123.45.67.89`)

## 2. SSH 키 만들기 (Windows PowerShell)

이미 키가 있으면 건너뛰세요. (`C:\Users\사용자\.ssh\id_ed25519.pub` 존재 여부)

```powershell
ssh-keygen -t ed25519 -C "autoblog"
# 엔터 3번 (기본 경로, 암호 없음)
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub   # 이 내용을 1-3 SSH 키에 붙여넣기
```

## 3. 서버 접속

```powershell
ssh ubuntu@공용IP
# 예: ssh ubuntu@123.45.67.89
# (Ubuntu 이미지의 기본 계정명은 ubuntu)
```

## 4. 코드 서버에 올리기

### 방법 A — GitHub (추천: 이후 업데이트가 `git pull` 로 끝남)

PC(로컬)에서 비공개 저장소를 만들어 푸시:
```powershell
cd D:\심소현\개인\AutoBlog
git init
git add .
git commit -m "autoblog bot"
# GitHub 에 비공개 repo 생성 후:
git remote add origin https://github.com/<본인>/<repo>.git
git push -u origin main
```
> `.env` 와 임시파일은 `.gitignore` 처리되어 올라가지 않습니다. (style-samples.txt 는 포함됨)

서버에서:
```bash
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/<본인>/<repo>.git autoblog
cd autoblog
```

### 방법 B — 파일 직접 전송 (git 없이)

PC PowerShell 에서 (node_modules 제외하고 전송):
```powershell
cd D:\심소현\개인
scp -r AutoBlog ubuntu@공용IP:~/autoblog
```
> node_modules 가 크면 전송 전에 지우세요. 서버에서 다시 설치합니다.

## 5. .env 만들기 (서버에서)

```bash
cd ~/autoblog        # 방법 A 면 ~/autoblog, B 면 ~/autoblog
nano .env
```
아래 내용을 붙여넣고 본인 값으로 채운 뒤 `Ctrl+O`, `Enter`, `Ctrl+X` 로 저장:
```
TELEGRAM_BOT_TOKEN=8533750888:AAFis...본인토큰
ALLOWED_TELEGRAM_USER_IDS=
GEMINI_API_KEY=AQ.Ab8R...본인키
GEMINI_MODEL=gemini-2.5-flash
GROUP_DEBOUNCE_MS=3000
```

## 6. 설치 + 실행 (자동 스크립트)

```bash
bash deploy/setup-server.sh
```
이 스크립트가 Node.js·pm2 설치, 의존성 설치, 봇 실행, **재부팅 자동 실행 등록**까지 합니다.

## 7. 확인

```bash
pm2 status                 # autoblog-bot 이 online 이면 성공
pm2 logs autoblog-bot      # "AutoBlog 봇 실행 중..." 로그 확인 (Ctrl+C 로 빠져나오기)
```
폰에서 @ssodaliyBot 에 사진+장소명 보내보세요. 이제 PC를 꺼도 응답합니다. 🎉

---

## 이후 운영

| 하고 싶은 것 | 명령 (서버에서) |
|---|---|
| 상태 보기 | `pm2 status` |
| 로그 보기 | `pm2 logs autoblog-bot` |
| 재시작 | `pm2 restart autoblog-bot` |
| 멈추기 | `pm2 stop autoblog-bot` |
| 코드 업데이트(방법 A) | `git pull && npm install && pm2 restart autoblog-bot` |
| 글 스타일 수정 | `nano data/style-samples.txt` → 저장 (봇 재시작 불필요) |

## 주의

- ⚠️ Oracle Always Free 인스턴스는 **장기간 미사용 시 회수**될 수 있습니다(과거 정책). 봇이 늘 돌고 있으면 사용 중이라 보통 괜찮습니다.
- ⚠️ 텔레그램은 **같은 봇 토큰을 동시에 두 곳에서 폴링하면 충돌(409)** 합니다. 서버에서 돌릴 거면 PC의 `npm start` 는 꺼두세요.
- 🔒 `.env` 는 서버에만 두고 외부에 노출하지 마세요.
