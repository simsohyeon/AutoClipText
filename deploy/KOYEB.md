# Koyeb 무료 배포 가이드 (GitHub 연동, 카드 불필요)

PC를 꺼도 봇이 24시간 돌아갑니다. Koyeb 무료 티어는 **잠들지 않아서** 폴링 봇에 딱 맞아요.

> 코드는 이미 GitHub(`simsohyeon/AutoClipText`)에 있고, 클라우드용 헬스체크 서버 +
> Dockerfile 도 들어가 있어 바로 배포 가능합니다.

---

## 1. Koyeb 가입

1. https://www.koyeb.com → **Sign up**
2. **GitHub 계정으로 로그인** (가장 간단, 카드 안 물어봄)

## 2. 서비스 생성 (GitHub에서 배포)

1. 대시보드 → **Create Service** → **GitHub** 선택
   - 처음이면 Koyeb에 GitHub 저장소 접근 권한을 한 번 허용해야 함 (Install & Authorize)
2. **Repository**: `simsohyeon/AutoClipText` 선택, **Branch**: `main`
3. **Builder**: `Dockerfile` 자동 감지됨 (그대로 두기)
4. **Instance**: **Free** (Nano) 선택
5. **Region**: 아무거나 (Washington/Frankfurt 등)

## 3. 환경변수 설정 (가장 중요)

서비스 설정의 **Environment variables** 에서 추가하세요. (`.env` 대신 여기에 넣습니다)

| Name | Value | 비고 |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | `8533750888:AAFis...` | **Type: Secret** 권장 |
| `GEMINI_API_KEY` | `AQ.Ab8R...` | **Type: Secret** 권장 |
| `GEMINI_MODEL` | `gemini-2.5-flash` | (선택, 안 넣으면 기본값) |
| `ALLOWED_TELEGRAM_USER_IDS` | (본인 텔레그램 ID) | (선택, 본인만 사용 제한) |

> `PORT` 는 Koyeb 가 자동으로 줍니다. 직접 넣지 마세요.

## 4. 배포 & 확인

1. **Deploy** 클릭 → 빌드(2~4분) 대기
2. 서비스의 **Logs** 탭에서 아래가 보이면 성공:
   ```
   헬스체크 서버 포트: 8000
   AutoBlog 봇 실행 중... (Ctrl+C 로 종료)
   ```
3. **Health check**: 포트 8000, 경로 `/` 로 자동 설정됨 (안 되면 Settings → Health checks 에서 포트 8000 확인)
4. 폰에서 @ssodaliyBot 에 사진+장소명 전송 → 이제 PC 꺼도 응답! 🎉

---

## 이후 운영

- **코드 수정 반영**: PC에서 `git push` → Koyeb 가 자동 재배포 (Autodeploy 기본 켜짐)
- **글 스타일 수정**: `data/style-samples.txt` 고치고 `git push` → 자동 재배포
- **로그/상태**: Koyeb 대시보드 → 서비스 → Logs

## 주의

- ⚠️ **같은 봇 토큰을 두 곳에서 폴링하면 충돌(409)** → Koyeb 에 올렸으면 PC의 `npm start` 는 끄세요.
- ⚠️ 무료 티어는 **서비스 1개**까지. 충분합니다.
- 🔒 토큰/키는 Koyeb 환경변수(Secret)에만 두고 코드/깃에 넣지 마세요. (이미 `.env` 는 깃 제외됨)
