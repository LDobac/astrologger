# comment_and_view

블로그 댓글·조회수 API (Cloudflare Workers + D1).

## 명령

`services/comment_and_view`에서 실행하거나, 루트에서 `yarn workspace comment_and_view <script>`.

- `yarn dev` — 로컬 실행 (로컬 D1, `.wrangler/state`). `http://localhost:4321` Origin도 허용한다. `.dev.vars`에 `VIEW_PEPPER`가 있어야 조회수 집계가 동작한다
- `yarn types` — `wrangler.jsonc` 변경 후 `worker-configuration.d.ts` 재생성
- `yarn typecheck` — 생성 타입 최신 여부 확인 + `tsc`
- `yarn deploy` — 배포
- `yarn wrangler d1 migrations apply DB --local|--remote` — 마이그레이션 적용

## API

모든 응답은 JSON. 오류는 `{ "error": "<code>" }`.

| Method | Path | Body | 성공 |
|---|---|---|---|
| GET | `/comments?slug=<slug>` | - | 200 `Comment[]` |
| POST | `/comments` | `{ postSlug, parentId?, nickname, password, email?, content, website?, turnstileToken? }` | 201 `Comment` |
| PATCH | `/comments/:id` | `{ password, content }` | 200 `Comment` |
| DELETE | `/comments/:id` | `{ password }` | 204 |
| GET | `/views/:slug` | - | 200 `{ count }` |
| POST | `/views/:slug` | 없음 | 200 `{ count, counted }` |

`Comment` = `{ id, parentId, nickname, content, createdAt, updatedAt }` (ISO 8601 UTC). `email`과 비밀번호 해시는 응답에 포함되지 않는다.

댓글 조회는 query `slug`, 생성은 body `postSlug`를 쓴다. 조회수는 path에 URL 인코딩한 slug를 쓴다(NFC로 정규화). `parentId`는 JSON 숫자여야 한다(문자열 `"5"`는 400). CORS preflight(OPTIONS)는 허용된 Origin만 204, 그 외는 403.

정책:
- 답글은 1단계만. `parentId`는 같은 `postSlug`의 최상위 댓글이어야 한다.
- 답글이 달린 댓글은 수정/삭제할 수 없다 (409 `has_replies`).
- 수정은 본문만 가능하다.
- 글 하나당 댓글은 최대 300개(409 `comment_limit`). 조회도 300개까지 반환하므로 잘리지 않는다.

입력 제한: nickname 1–20자, password 4–72자, email ≤254자(선택, 빈 문자열은 미입력), content 1–2000자, postSlug 1–200자(`문자/숫자/_/-`). 요청 본문은 `Content-Type: application/json`, 16KB 이하.

조회수:
- `GET`은 집계하지 않고 현재 값만 반환한다. 기록이 없으면 `0`.
- `POST`는 body가 없다(`Content-Type`도 없음). CORS preflight 없이 `fetch(url, { method: "POST" })`나 `navigator.sendBeacon(url)`으로 보낼 수 있다.
- 허용된 `Origin`이 필수다. 없거나 허용되지 않으면 403 `forbidden_origin`.
- `counted: false`는 중복이거나 봇으로 판단되어 집계하지 않았다는 뜻이다. 상태 코드는 200이다.
- `POST_FEED_URL`(RSS)에 없는 slug는 404 `not_found`. 이미 집계된 적이 있는 slug는 RSS를 확인하지 않는다.
- 429면 그 조회는 집계되지 않는다. 프론트엔드는 `GET`으로 값을 받아 표시하거나 표시하지 않는다.

오류 코드: `invalid_request`, `invalid_json`, `invalid_slug`, `invalid_parent`, `invalid_nickname`, `invalid_password`, `invalid_email`, `invalid_content`, `unsupported_media_type`(415), `payload_too_large`(413), `captcha_failed`(403), `wrong_password`(403), `forbidden_origin`(403), `not_found`(404), `method_not_allowed`(405), `has_replies`(409), `comment_limit`(409), `rate_limited`(429), `internal_error`(500).

## 보안 / 스팸

- 비밀번호: 클라이언트는 HTTPS로 평문 전송, 서버가 PBKDF2-SHA256(100,000회, Workers 상한) + 16바이트 salt로 해싱. `pw_hash` 형식은 `pbkdf2-sha256$<iterations>$<base64>`라 반복 횟수를 바꿔도 기존 해시를 검증할 수 있다.
- Rate limit (`CF-Connecting-IP` 기준, IPv6는 /64 단위): 조회 60회/60초, 생성 5회/60초, 수정·삭제 10회/60초. 수정·삭제는 추가로 댓글 하나당 10회/60초(여러 IP로 한 댓글의 비밀번호를 대입하는 것 방지). Workers Rate Limiting은 근사치이며 데이터센터별로 집계된다.
- Honeypot: `website` 필드가 채워져 있으면 400 `invalid_request`.
- Turnstile: `TURNSTILE_SECRET` 시크릿이 설정된 경우에만 `turnstileToken`을 검증한다. 설정: `yarn wrangler secret put TURNSTILE_SECRET`. 로컬은 `.dev.vars`(gitignore됨)에 넣는다.
- CORS: `ALLOWED_ORIGINS`(wrangler.jsonc `vars`)에 있는 Origin만 허용. 변경 요청에 허용되지 않은 `Origin`이 있으면 403.
- 닉네임에서 제어문자, zero-width 문자, bidi 제어문자를 제거한다. 본문은 개행·탭과 이모지용 ZWJ는 유지하고 bidi 제어문자는 제거한다.
- 알려진 한계 (댓글): `postSlug`가 실제 존재하는 글인지는 검증하지 않는다. Turnstile 응답의 hostname은 확인하지 않는다(사이트 키 자체가 등록된 hostname에서만 발급됨).

## 조회수 중복·스팸 방지

- 중복: (UTC 날짜, 방문자, slug)마다 하루 1회. 방문자는 IPv4 주소 또는 IPv6 /56 대역이다.
- 저장 값: `HMAC-SHA256(VIEW_PEPPER, 날짜별 salt ‖ 방문자 ‖ slug)`만 `view_hits`에 저장한다. 원본 IP는 저장하지 않는다.
- salt: 날마다 D1에서 랜덤 생성한다. 그 날의 첫 요청을 처리하는 isolate가 지난 날짜의 `view_hits`와 `view_salts`를 삭제한다(cron 없음). 요청이 없는 날에는 삭제도 미뤄진다.
- `VIEW_PEPPER`: `wrangler.jsonc`의 `secrets.required`. 32자 이상이어야 하고, 없으면 `POST /views`가 500을 반환한다.
  - 설정: `yarn wrangler secret put VIEW_PEPPER`. 로컬은 `.dev.vars`에 넣는다.
  - DB만 유출돼서는 해시를 IP로 되돌릴 수 없다. pepper를 바꾸면 그 날의 중복 판단만 초기화된다.
- Rate limit: `POST /views`는 IPv4 주소 또는 IPv6 /56당 30회/60초.
- 봇: User-Agent가 비었거나, 512자를 넘거나, 봇·스크립트 패턴(`bot`, `crawl`, `curl`, `python`, `headless` 등)이면 집계하지 않는다. 헤더를 꾸미는 스크립트는 막지 못하고, 그 경우는 IP 기준 중복 방지와 rate limit에 의존한다.
- slug 검증: 블로그 RSS(`POST_FEED_URL`)에 있는 글만 허용한다. 페이지네이션 `/posts/2/` 등은 거부한다.
  - 목록은 isolate 메모리에 5분 캐시한다. 목록에 없는 slug면 1분이 지난 뒤 다시 받아온다. 새 글은 배포 후 최대 1~2분 뒤부터 집계된다.
  - `POST_FEED_URL`이 비어 있으면 모두 거부한다.
- 알려진 한계:
  - 같은 공인 IP(회사·학교 NAT, 통신사 CGNAT) 사용자는 하루 1명으로 집계된다.
  - 날짜는 UTC 기준이라 한국 시간 09:00에 바뀐다.
  - 글 제목을 바꾸면 slug가 바뀌어 조회수가 새로 시작되고, 이전 slug의 값은 남는다.
  - D1 Time Travel로 삭제된 salt와 해시가 일정 기간 복구될 수 있다(pepper 없이는 IP를 알 수 없음).

## 프론트엔드 연동 시 주의

- `nickname`, `content`는 원문 그대로 저장된다. 반드시 `textContent` 등 텍스트로 렌더링하고 `innerHTML`에 넣지 않는다.
- 폼에 honeypot 필드 `website`를 CSS로 숨겨서 두고 그대로 전송한다.
- Turnstile을 켜면 위젯 토큰을 `turnstileToken`으로 보낸다.
