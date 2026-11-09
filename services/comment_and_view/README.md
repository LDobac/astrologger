# comment_and_view

블로그 댓글 API (Cloudflare Workers + D1).

## 명령

`services/comment_and_view`에서 실행하거나, 루트에서 `yarn workspace comment_and_view <script>`.

- `yarn dev` — 로컬 실행 (로컬 D1, `.wrangler/state`). `http://localhost:4321` Origin도 허용한다
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

`Comment` = `{ id, parentId, nickname, content, createdAt, updatedAt }` (ISO 8601 UTC). `email`과 비밀번호 해시는 응답에 포함되지 않는다.

조회는 query `slug`, 생성은 body `postSlug`를 쓴다. `parentId`는 JSON 숫자여야 한다(문자열 `"5"`는 400). CORS preflight(OPTIONS)는 허용된 Origin만 204, 그 외는 403.

정책:
- 답글은 1단계만. `parentId`는 같은 `postSlug`의 최상위 댓글이어야 한다.
- 답글이 달린 댓글은 수정/삭제할 수 없다 (409 `has_replies`).
- 수정은 본문만 가능하다.
- 글 하나당 댓글은 최대 300개(409 `comment_limit`). 조회도 300개까지 반환하므로 잘리지 않는다.

입력 제한: nickname 1–20자, password 4–72자, email ≤254자(선택, 빈 문자열은 미입력), content 1–2000자, postSlug 1–200자(`문자/숫자/_/-`). 요청 본문은 `Content-Type: application/json`, 16KB 이하.

오류 코드: `invalid_request`, `invalid_json`, `invalid_slug`, `invalid_parent`, `invalid_nickname`, `invalid_password`, `invalid_email`, `invalid_content`, `unsupported_media_type`(415), `payload_too_large`(413), `captcha_failed`(403), `wrong_password`(403), `forbidden_origin`(403), `not_found`(404), `method_not_allowed`(405), `has_replies`(409), `comment_limit`(409), `rate_limited`(429), `internal_error`(500).

## 보안 / 스팸

- 비밀번호: 클라이언트는 HTTPS로 평문 전송, 서버가 PBKDF2-SHA256(100,000회, Workers 상한) + 16바이트 salt로 해싱. `pw_hash` 형식은 `pbkdf2-sha256$<iterations>$<base64>`라 반복 횟수를 바꿔도 기존 해시를 검증할 수 있다.
- Rate limit (`CF-Connecting-IP` 기준, IPv6는 /64 단위): 조회 60회/60초, 생성 5회/60초, 수정·삭제 10회/60초. 수정·삭제는 추가로 댓글 하나당 10회/60초(여러 IP로 한 댓글의 비밀번호를 대입하는 것 방지). Workers Rate Limiting은 근사치이며 데이터센터별로 집계된다.
- Honeypot: `website` 필드가 채워져 있으면 400 `invalid_request`.
- Turnstile: `TURNSTILE_SECRET` 시크릿이 설정된 경우에만 `turnstileToken`을 검증한다. 설정: `yarn wrangler secret put TURNSTILE_SECRET`. 로컬은 `.dev.vars`(gitignore됨)에 넣는다.
- CORS: `ALLOWED_ORIGINS`(wrangler.jsonc `vars`)에 있는 Origin만 허용. 변경 요청에 허용되지 않은 `Origin`이 있으면 403.
- 닉네임에서 제어문자, zero-width 문자, bidi 제어문자를 제거한다. 본문은 개행·탭과 이모지용 ZWJ는 유지하고 bidi 제어문자는 제거한다.
- 알려진 한계: `postSlug`가 실제 존재하는 글인지는 검증하지 않는다. Turnstile 응답의 hostname은 확인하지 않는다(사이트 키 자체가 등록된 hostname에서만 발급됨).

## 프론트엔드 연동 시 주의

- `nickname`, `content`는 원문 그대로 저장된다. 반드시 `textContent` 등 텍스트로 렌더링하고 `innerHTML`에 넣지 않는다.
- 폼에 honeypot 필드 `website`를 CSS로 숨겨서 두고 그대로 전송한다.
- Turnstile을 켜면 위젯 토큰을 `turnstileToken`으로 보낸다.
