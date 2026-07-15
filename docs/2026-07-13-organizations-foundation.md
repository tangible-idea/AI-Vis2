# Sightline 업데이트 — Organization 레이어 & 데이터 파운데이션 (2026-07-13)

기존 아키텍처를 유지한 채 확장한 통합 업데이트입니다.
재작성 없음 · 새 인프라 없음 · 새 의존성 없음 · 빌드/린트 통과.

---

## 1. 데이터베이스 — `supabase/migrations/0006_organizations_foundation.sql`

### `organizations` (신규)
- 고객 계정당 1개. `profiles` insert 트리거로 **자동 생성** + 기존 사용자 백필.
- UI에는 완전히 비노출(경량 레이어). 사용자가 직접 만들거나 관리하지 않음.
- 빌링은 당분간 `profiles.plan`에 유지 — org는 향후 구독·팀·API 키·화이트라벨
  이전을 위한 소유권 앵커.

### `projects` 컬럼 추가
| 컬럼 | 용도 |
|---|---|
| `org_id` | DB 트리거가 자동으로 채움 (앱 코드는 건드리지 않음) |
| `archived_at` | 아카이브 시각. 데이터는 유지, 플랜 한도에서 제외 |
| `logo_url` | 브랜드 로고 (현재는 파비콘 폴백 사용, 업로드는 이연) |

### `ai_responses` (신규 — 공유 응답 캐시)
- 키: `sha256(prompt)` + engine + country + language.
- **24시간 창** 안에서 동일 요청은 조직·프로젝트·마켓·예약 스캔을 가로질러
  캐시를 재사용 → 프로바이더 호출 중복 제거.
- RLS 활성화 + 정책 없음 = **service-role 전용**. 사용자에게 절대 노출되지 않음.
- Mock 모드 응답은 프로젝트 컨텍스트가 주입되므로 캐시에서 제외.

### `prompt_observations` (신규 — 익명 프롬프트 메타데이터)
- 저장 항목: prompt 해시, intent, country, language, industry, engine,
  brand/competitor 언급 여부, 인용 여부, 소스 도메인, 스캔 시각.
- **user/org/project 키가 아예 없음** → 고객 신원 노출이 구조적으로 불가능.
- 향후 Market Benchmarks가 집계할 저장 레이어. 점수화·클러스터링·분석은
  의도적으로 미구현 (데이터 먼저, 인텔리전스는 나중).

---

## 2. 플랜 & 프로젝트 한도 — `src/lib/plans.ts`

| 플랜 | 활성 프로젝트 |
|---|---|
| Free | 1 |
| Starter | 3 |
| Pro | **8** (10에서 변경) |
| AppSumo Lifetime | **2** (기본값, `PLAN_LIMITS_JSON`으로 무배포 조정) |

- 한도는 **활성(비아카이브·비데모) 프로젝트만** 카운트.
  모든 검사 경로에 `.is("archived_at", null)` 적용:
  `createProject` · `addMarket` · `restoreProject` · `/api/scan` · 스위처 · 주간 다이제스트.
- 한도 도달 시: 생성 차단 + 현재 플랜 한도 설명 + **아카이브/삭제 안내 + 업그레이드 CTA**.
- AppSumo 한도는 가격 페이지 등 공개 UI에 계속 비노출.
- `benchmarks` 플랜 플래그 추가 (free: false, 나머지: true).

---

## 3. Project Switcher — `src/components/project-switcher.tsx` (신규)

사이드바의 `<select>`를 대체:

- 브랜드 로고(파비콘 폴백) · 브랜드명 · 도메인 · **최신 AI Visibility 점수** · 마지막 스캔 시각
- 프로젝트 **검색**
- 즐겨찾기 **핀** (localStorage `sightline_pins`)
- **새 프로젝트 생성** (한도 도달 시 업그레이드 CTA로 대체)
- 마켓 형제 프로젝트(같은 website, 다른 country)는 **하나의 브랜드 항목**으로 그룹핑
  — "프로젝트가 기본 작업 단위, 마켓은 그 아래" 원칙 유지. 마켓 전환은 기존 MarketTabs 그대로.
- 전환은 기존 `switchProject` 쿠키 액션 재사용 → 불필요한 전체 리로드 없음.
- 모바일은 기존 select 유지 (단순성).

스위처 메타데이터(점수·마지막 스캔)는 `(app)/layout.tsx`에서 snapshots 1쿼리로 조회.

---

## 4. 프로젝트 아카이브/복원 — Settings

- **Archive project**: 데이터 유지, 작업 목록·플랜 한도에서 제외. (`archiveProject`)
- **Archived projects 카드**: 보관된 프로젝트 목록 + **Restore** (복원 시 플랜 한도 검사,
  초과면 에러 + 업그레이드 안내). (`restoreProject`)
- Delete는 기존 그대로. Danger zone에 Archive가 더 온화한 선택지로 함께 배치.
- 아카이브된 프로젝트는 스캔 차단(API + runner 이중 방어), 다이제스트 메일 제외.

---

## 5. Cited Sources 개선 — `src/app/(app)/sources/page.tsx`

- 소스별 표시: **웹사이트 제목**(엔진 답변의 마크다운 링크 텍스트에서 추출 —
  네트워크 호출 0) · 도메인 · 참조한 AI 플랫폼 ·
  **브랜드 언급 Yes/No** · **경쟁사 언급 Yes/No** 배지.
- 펼치면: 원본 프롬프트 · AI 응답 · **인용된 원문**(하이라이트) · 인용 이유.
- 고객 브랜드는 **굵게 + 하이라이트**, 경쟁사는 기존 Badge 스타일.
- `7×` 같은 기술 지표 제거 → *"이 소스는 비슷한 소스보다 약 7배 더 자주
  나타났습니다"* 식의 사람 친화적 문구 (중앙값 대비 배율).
- analyzer(`extractSources`)가 `[제목](url)` 링크의 제목을 `CitationSource.title`로 캡처.

---

## 6. Trends 개편 — `src/app/(app)/trends/explorer.tsx`

기존 캐시된 결정적 데이터를 재구성 — **추가 API 호출 0, 반복 비용 0**:

- **Explore**
  - *Top queries* — 검색량 순 (시장이 가장 많이 묻는 것)
  - *Rising queries* — 성장률 순 (경쟁자보다 먼저 다뤄야 할 것)
- **Trending now** — 주목받는 폭넓은 테마
- 각 트렌드: 방향(↗︎/→/↘︎) · 상대 인기(검색량) · **원클릭 콘텐츠 액션**
  (FAQ / Blog / Landing / Comparison / LinkedIn → 기존 생성기로 연결)
- 국가·언어는 기존 쿼리(`project.country/language`)로 이미 반영.

---

## 7. Dashboard — `src/app/(app)/dashboard/page.tsx`

- 점수 바로 아래 **한 줄 설명** 추가:
  *"AI 가시성 점수는 주요 AI 플랫폼에서 브랜드가 얼마나 자주 발견되고
  인용되는지를 나타냅니다."* — 채점 방법론은 비노출, 경영진 친화적.
- 추이 카드를 **주간 라인 차트**로 교체 (`WeeklyScoreTrend`, `charts.tsx` 신규):
  ISO 주 단위 버킷(주당 마지막 스냅샷 1점) → 스캔별 노이즈 제거.
  전체 히스토리는 /improve에 그대로.

---

## 8. Market Benchmarks 파운데이션 — `/benchmarks` (신규 페이지)

- 플레이스홀더 카드 5종 (계산 로직 의도적 미구현):
  Share of Voice · AI Visibility Distribution · Prompt Coverage ·
  Benchmark Trends · Recommended Actions — 각각 "Coming soon" 배지.
- **Free 플랜**: 🔒 티저 4줄(벤치마크 · 시장 인기 프롬프트 · 업계 비교 ·
  최고 성과 콘텐츠) + 업그레이드 CTA. 점진적 노출, 공격적 페이월 없음.
- 데이터 프라이버시 문구 명시: 집계·익명 통계만 사용.
- 사이드바 Improve 그룹에 메뉴 추가.

---

## 9. AI 응답 수집 아키텍처 권고 (§14)

**결론: POE 유지 + 캐시 레이어 추가** (구현 완료).

| 항목 | 현재 (POE + 캐시) | 대안 (엔진별 공식 API 직결) |
|---|---|---|
| 비용 | 키 1개, 스캔 콜당 ~$0.005–0.01, 캐시로 체감 하락 | 유사하나 5개 벤더 계약·과금 관리 |
| 신뢰성 | 단일 의존점 (리스크) | 벤더별 장애 격리 (우수) |
| 확장성 | 모델명만 추가하면 엔진 추가 | 엔진마다 어댑터 개발 |
| 유지보수 | 어댑터 1개 | 어댑터 5개 — 2인 팀에 과부하 |
| ToS 준수 | 공식 API | 공식 API |

- `AIProvider` 추상화가 이미 provider-agnostic → 향후 전환은 `getProvider()`
  라우팅 확장만으로 가능, 대규모 리팩터링 불필요.
- 부트스트랩 SaaS의 실질 비용 레버는 교체가 아니라 **중복 제거**:
  동일 업종 고객이 늘수록 캐시 적중률이 올라가 한계비용이 하락.
- 인증·레이트리밋·페이월 우회 기법은 사용하지 않음.

---

## 10. i18n

- 신규 키 **60개 × 8개 언어** (en/ko/ja/zh/th/vi/id/ms) 추가.
- 신규 섹션: `switcher`, `benchmarks` / 확장: `common`, `nav`, `dashboard`,
  `sources`, `trends`, `settings`.
- 8개 로케일 키 구조 동일성 검증 완료 (로케일당 414키).

---

## 변경 파일 목록

**신규**
- `supabase/migrations/0006_organizations_foundation.sql`
- `src/components/project-switcher.tsx`
- `src/app/(app)/benchmarks/page.tsx`

**수정**
- `src/lib/types.ts` — `Organization`, `Project.org_id/archived_at/logo_url`, `CitationSource.title`
- `src/lib/plans.ts` — Pro 8 / Lifetime 2, `benchmarks` 플래그
- `src/lib/project.ts` — 아카이브 필터
- `src/lib/scan/runner.ts` — 응답 캐시, `promptHash()`, 익명 관측 수집, 아카이브 가드
- `src/lib/scan/analyzer.ts` — 소스 제목 캡처
- `src/components/sidebar.tsx` — 스위처 연결, Benchmarks 메뉴
- `src/components/charts.tsx` — `WeeklyScoreTrend`
- `src/app/(app)/layout.tsx` — 스위처 메타데이터 조회
- `src/app/(app)/actions.ts` — 활성 프로젝트 카운팅, 에러 문구
- `src/app/(app)/settings/actions.ts` — `archiveProject` / `restoreProject`
- `src/app/(app)/settings/page.tsx`, `settings/danger.tsx` — 아카이브 UI
- `src/app/(app)/sources/page.tsx` — Sources 개편
- `src/app/(app)/trends/explorer.tsx` — Explore/Trending now 구조
- `src/app/(app)/dashboard/page.tsx` — 점수 설명 + 주간 차트
- `src/app/(app)/billing/plan-picker.tsx` — Pro 문구
- `src/app/api/scan/route.ts` — 아카이브 프로젝트 스캔 차단
- `src/app/api/cron/digest/route.ts` — 아카이브 제외
- `src/lib/i18n/locales/*.json` (8개)

---

## 수동 테스트 체크리스트

1. `supabase db push`로 0006 적용 — 기존 사용자 org 백필 확인.
2. 온보딩 → 프로젝트 생성 → 한도 초과 시 에러 문구(아카이브 안내 + 업그레이드) 확인.
3. Settings에서 아카이브 → 스위처에서 사라지고 한도 미포함 → 복원
   (한도 초과 상태에서 복원 시 에러) 확인.
4. 스캔 2회 연속 실행 → 두 번째가 캐시를 타는지 (`ai_responses` 행 수) 확인.
5. Sources에서 브랜드 하이라이트 · Yes/No 배지 · 빈도 문구 확인.
6. 8개 언어에서 새 UI 문구 표시 확인.
7. Free 계정으로 /benchmarks 잠금 화면, Starter/Pro로 플레이스홀더 확인.

## 이연 항목 (의도적)

- 빌링/팀의 organization 레벨 이전
- 브랜드 로고 업로드 (현재 파비콘 폴백)
- 벤치마크 계산 (관측 데이터 축적 후)
- Google Trends 실소스 연동 (SerpAPI/DataForSEO 등)
- `timeAgo()` 로컬라이즈
