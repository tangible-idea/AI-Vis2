# AI 응답 스크래퍼 (실험용 프로토타입)

ChatGPT / Gemini **웹 UI**에 질문 하나를 넣고, 화면에 렌더링된 답변을
읽어오는 개인 연구용 프로토타입입니다. Playwright(Python)로 사용자
**본인의 로그인 세션**을 몰아서 동작합니다.

> ⚠️ **이건 프로덕션 도구가 아닙니다.**
> - ChatGPT·Gemini 웹 UI의 자동화 접근은 두 플랫폼의 **이용약관(ToS) 위반**입니다.
>   개인 실험·학습 목적으로만 사용하세요. Sightline 등 상용 서비스의 데이터
>   소스로 쓰면 계정 정지 → 서비스 중단 위험이 있습니다. 실제 스캔은 POE /
>   공식 API + 캐시 경로를 유지하세요.
> - 이 도구는 **탐지 우회 기능을 일부러 넣지 않았습니다.** stealth,
>   핑거프린트 위조, CAPTCHA 자동 해결, 프록시 로테이션 없음.
>   Cloudflare 챌린지나 로그인이 뜨면 **보이는 브라우저 창에서 직접** 처리합니다.
> - 웹 UI의 DOM/셀렉터는 수시로 바뀝니다. 셀렉터가 깨지면
>   `engines/*.py`의 `SELECTORS`만 고치면 됩니다.

---

## 동작 방식

1. 엔진별 **영구 브라우저 프로필**(`.userdata/<engine>/`)을 headed 모드로 띄웁니다.
2. 처음 한 번은 사용자가 직접 로그인합니다(본인 계정). 세션이 프로필에
   저장되므로 다음 실행부터는 로그인 유지됩니다.
3. 질문을 사람 속도로 입력 → 전송 → **답변 텍스트가 멈출 때까지**(스트리밍
   종료 감지) 폴링 → 최종 텍스트를 stdout / JSON으로 반환합니다.

인증을 우회하지 않습니다 — **사용자 본인의 진짜 세션**을 그대로 사용합니다.

---

## 설치

```bash
cd scrapers
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium
```

## 최초 로그인 (엔진별 1회)

```bash
python scrape.py --engine chatgpt --login
python scrape.py --engine gemini  --login
```

브라우저 창이 뜨면 직접 로그인한 뒤, 터미널에서 Enter를 눌러 세션을 저장합니다.

## 질문 실행

```bash
python scrape.py --engine chatgpt --prompt "best CRM for startups in 2026"
python scrape.py --engine gemini  --prompt "best CRM for startups in 2026" --json
```

여러 질문을 파일로:

```bash
# --out 을 쓰면 프로세스가 중간에 죽어도 결과가 파일로 남습니다 (권장).
python scrape.py --engine chatgpt --prompts-file prompts.txt --out out.json
```

> **`> out.json` 리다이렉트로 받았는데 파일이 비어 있다면?**
> 결과 출력 전에 예외가 나서 죽은 것입니다(로그·에러는 stderr로 나가고
> stdout은 비어 리다이렉트 파일이 0바이트가 됨). `--out out.json`을 쓰면
> `try/finally`로 **항상** 파일에 씁니다. 답변이 빈 경우(셀렉터 변경 등)에는
> `.userdata/debug/`에 스크린샷을 남기니 그걸로 원인을 확인하세요.

## 옵션

| 플래그 | 설명 |
|---|---|
| `--engine {chatgpt,gemini}` | 대상 엔진 (필수) |
| `--prompt "..."` | 질문 1개 |
| `--prompts-file PATH` | 한 줄에 하나씩 질문 목록 |
| `--login` | 로그인 전용 모드 (질문 안 보냄) |
| `--json` | 결과를 JSON으로 stdout에 출력 |
| `--out PATH` | 결과를 파일에 직접 기록 (크래시에도 보존됨, 권장) |
| `--headless` | 창 숨김 (로그인/챌린지 필요 없을 때만; 권장하지 않음) |
| `--timeout N` | 답변 대기 최대 초 (기본 120) |

---

## FastAPI 서버

같은 스크래핑 코어(`runner.py`)를 HTTP로 노출합니다. 호출이 오면 JSON을 돌려줍니다.

```bash
# 먼저 엔진별 로그인 (1회, CLI로)
python scrape.py --engine chatgpt --login

# 서버 실행
uvicorn server:app --host 127.0.0.1 --port 8100
# 또는: python server.py
```

호출:

```bash
curl -s -X POST http://127.0.0.1:8100/scan \
  -H 'content-type: application/json' \
  -d '{"engine":"chatgpt","prompts":["best CRM for startups"]}' | jq
```

요청 본문:

| 필드 | 타입 | 설명 |
|---|---|---|
| `engine` | string | `chatgpt` \| `gemini` (필수) |
| `prompt` | string | 질문 1개 |
| `prompts` | string[] | 질문 여러 개 |
| `timeout` | int | 답변당 최대 초 (기본 120, 10–600) |
| `headless` | bool | 창 숨김 (권장하지 않음) |

응답(JSON):

```json
{
  "engine": "chatgpt",
  "ready": true,
  "ok": true,
  "error": null,
  "results": [
    { "engine": "chatgpt", "prompt": "...", "answer": "...", "ok": true,
      "error": null, "elapsed_s": 12.3, "meta": {} }
  ]
}
```

- `GET /health` → `{ ok, engines, busy }` 로 상태·진행 중 여부 확인.
- 대화형 API 문서: `http://127.0.0.1:8100/docs`

### 서버 동작 특성 (중요)

- **요청은 한 번에 하나씩** 처리됩니다(`asyncio.Lock`). persistent 브라우저
  프로필은 동시 세션을 공유할 수 없고, 사람 속도 순차 접근이 전제이기 때문입니다.
  동시에 여러 요청이 오면 뒤 요청은 앞 요청이 끝날 때까지 대기합니다.
- 로그인이 안 된 상태로 호출하면 `ready:false`, `error`에 안내가 담겨 돌아옵니다.
  먼저 CLI `--login`으로 세션을 저장하세요.
- 서버와 CLI를 **동시에 같은 엔진으로 돌리지 마세요**(프로필 충돌). 하나만 쓰세요.
- 로컬 전용(`127.0.0.1`)으로 두세요. ToS 특성상 외부에 공개 API로 노출하면 안 됩니다.

## 견고성 (OneGlanse 오픈소스에서 이식, MIT)

로그인 넛지가 반복해서 뜨는 문제를 줄이기 위해 [OneGlanse](https://github.com/aryamantodkar/oneglanse) 에이전트의 패턴을 이식했습니다:

- **생명주기 훅 dismiss** — 팝업을 한 번이 아니라 `before_prompt / after_typing / before_submit / after_submit` + 응답 대기 루프의 매 틱마다 닫습니다(`engines/base.py`).
- **다이얼로그 스코프 셀렉터** — 전역 텍스트 검색 대신 `[role="dialog"][data-state="open"]` + 텍스트(`Thanks for trying ChatGPT` / `Log in or sign up`)로 모달을 특정하고 그 안의 "Stay logged out"만 클릭(`engines/chatgpt.py`).
- **사람형 입력** — 청크 단위 지연 타이핑 + 마우스를 움직여 클릭(`type_like_user` / `click_like_user`).
- **안정화 기반 완료 감지** — 응답 텍스트가 일정 시간 변하지 않고 스트리밍 인디케이터가 사라지면 완료(장기 정체 시 force-exit).
- **인용 소스 추출** — 응답 텍스트 정규식이 아니라 UI의 소스 패널에서 실제 인용 링크(`url` / `domain` / `title` / `cited_text`)를 읽습니다. ChatGPT 추출기는 OneGlanse `extractSources.ts`를 그대로 포팅. 결과 JSON의 `sources[]`에 담깁니다.
- **챌린지/하드월 감지** — dismiss로 못 넘는 전면 봇/로그인 벽("Just a moment" 등)을 감지해 무한 대기 대신 명확한 사유로 실패 처리.
- **제출 폴백** — Enter로 전송이 안 되면 send 버튼 클릭으로 폴백.
- **프롬프트 간 리셋** — 각 프롬프트를 **새 대화**에서 실행해 이전 스레드에 오염되지 않게 함(스캔 독립성).

> **이식하지 않은 것**: Camoufox 스텔스 브라우저·주거용 프록시 회전(핑거프린트/탐지 우회). 그래서 ChatGPT의 **익명 하드월**은 이 도구로 못 뚫습니다 — 그때는 로그인(세션 유지)이 정답입니다.

## 더 큰 그림: OneGlanse self-host

이 프로토타입은 "경량 로컬 실험"용입니다. 신뢰할 수 있는 스캔 엔진이 필요하면 **OneGlanse를 self-host**하는 편이 유지보수 면에서 낫습니다(Camoufox·프록시·프로바이더별 생명주기·소스 추출이 이미 포함, MIT):

- **로컬 모드**는 프록시 없이 Docker로 구동, `pnpm auth`로 내 로그인 세션 캡처 → 위 문제들이 상당 부분 해결됨.
- VPS 배포 시엔 **주거용 프록시가 필수**(데이터센터 IP 차단).
- 결과는 본인 소유 Postgres/ClickHouse에 저장되므로 Sightline이 그 DB를 읽어 스캔 엔진으로 삼는 것도 가능.
- 문서: https://docs.oneglanse.com/self-hosted-setup

## 한계

- 봇 탐지에 걸리면 실패합니다. 이 도구는 **뚫지 않습니다** — 사람이 풉니다.
- 셀렉터 변경에 취약합니다. UI 개편 시 `engines/*.py` 수정 필요.
- 동시 실행/대량 요청은 하지 마세요(탐지·계정 위험). 순차 + 사람 속도가 전제입니다.
