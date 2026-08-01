# 서버 API 문서 검증 기준선 (Server Baseline)

> `parfait/api/` 계약 문서를 **어느 서버 커밋 기준으로 마지막 검증했는지** 기록하는 단일 출처(SoT).
> "서버 API 문서 점검"을 요청받으면 아래 기준선부터 현재 `origin/main`까지의 **delta만** 감사하고,
> 끝나면 기준선을 갱신한다.

## 현재 기준선
- **repo**: `TEAMYG-SERVER` (`mash-up-kr/TEAMYG-SERVER`) **`main`**
- **커밋**: `6f5bffc`
- **요약**: `[Feat/#45] 토큰 재발급(refresh) / 로그아웃 API 구현 (#63)`
- **검증일**: 2026-08-02 (2회차)

### 왜 `main`인가
서버 저장소의 기본 브랜치가 `main`이고(`origin/HEAD -> origin/main`) 기능 PR이 main으로 머지된다.
`develop`은 main을 주기적으로 끌어오는 쪽이라 **뒤처진다** — 체계 신설 시점에 develop은
signup·파르페 연도 조회 두 API를 갖고 있지 않았다. 앱이 바라볼 서버는 main에서 나온다.

⚠️ TJYG-Android는 `develop`을 추적한다([doc-baseline.md](../doc-baseline.md)).
**두 저장소의 통합 브랜치 이름이 다르다** — 혼동하지 말 것.

## 점검 절차 (다음 요청 시)
로컬 경로는 개인정보라 `wiki/personal-private/project-paths.md` 참고(아래 `<S>`).

1. **최신화**: `git -C <S> fetch origin main`
2. **신규 커밋 나열**: `git -C <S> log --oneline <기준선>..origin/main`
   - 기능 PR이 squash로 들어와 merge 커밋이 아닐 수 있다 → **`--merges` 필터를 쓰지 않는다.**
   - 변경 파일: `git -C <S> show --stat <hash>`
3. **계약 대조**: 컨트롤러·`*Request`/`*Response` DTO·`*ErrorCode` enum·`SecurityConfig`·
   `ApiResponse`·`GlobalExceptionHandler` 변경이 `parfait/api/*.md`와 어긋나는지 검사.
   - 파일 조회는 항상 `git -C <S> show origin/main:<path>` — **워킹트리를 믿지 않는다**(로컬은 `develop`).
   - 신규 도메인이면 [template.md](template.md)로 문서 신설 + [README.md](README.md) 인덱스 등록.
4. **기준선 갱신**: 위 "현재 기준선"을 새 `origin/main` HEAD로 교체하고 아래 이력에 한 줄 추가.

## 기준선 이력
| 검증일 | main 커밋 | 요약 | 비고 |
|--------|-----------|------|------|
| 2026-08-01 | `6b05b8c` | `[Feat/#61] 그룹별 캘린더 연도 리스트 조회 API (#62)` | 체계 신설. 도메인 3건(auth 2·parfait-group 8·parfait 1) 전량 초기 작성. Android 대응 심볼 0건 → 전 엔드포인트 `미구현`. 불일치 3건·URL 규약 혼재 open-questions 등록. 체계 신설 도중 서버가 전진해 같은 라운드에서 `6f5bffc`로 올림 |
| 2026-08-02 | `6f5bffc` | `[Feat/#45] 토큰 재발급(refresh) / 로그아웃 API 구현 (#63)` | 패키지 전면 재편(`http/api/auth`→`http/auth`, `http/api/parfait`→`http/parfait`, `http/api/health`→`http/global/health`, `http/parfaitgroup/*.kt`→`{controller,dto,exception}/`) · auth 신규 엔드포인트 2(`reissue`·`logout`) · `AuthErrorCode` 12종(`FORBIDDEN_REFRESH_TOKEN` 신설) · 화이트리스트 `/api/v1/auth/**`→개별 3경로(`kakao`·`signup`·`reissue`) 축소, `logout` 제외 · 그룹(`parfait-group`) 계약 불변 |
