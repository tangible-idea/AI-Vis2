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

## 한계

- 봇 탐지에 걸리면 실패합니다. 이 도구는 **뚫지 않습니다** — 사람이 풉니다.
- 셀렉터 변경에 취약합니다. UI 개편 시 `engines/*.py` 수정 필요.
- 동시 실행/대량 요청은 하지 마세요(탐지·계정 위험). 순차 + 사람 속도가 전제입니다.
