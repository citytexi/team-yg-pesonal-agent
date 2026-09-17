# parfait 범위 지도

`parfait/`는 **플랫폼별 구현 문서 루트**다. 위키(`wiki/`)가 플랫폼 비종속 정책 SoT이고,
여기는 그 정책을 실제로 구현한 쪽의 문서다. 위키 스키마(`wiki/CLAUDE.md`)는 적용되지 않는다.

작업 유형 라우팅과 Git 규율은 저장소 루트 [`CLAUDE.md`](../CLAUDE.md)가 정본이다.

## 어디에 무엇이 있나

| 경로 | 범위 | 내용 |
|---|---|---|
| [`android/`](android/) | **Android 전용** | `adr`·`architecture`·`specs`·`plans`·`synthesis`·`doc-baseline.md`. TJYG-Android(`mash-up-kr/TEAMYG-Android`) 구현 문서 |
| [`api/`](api/) | **플랫폼 공용** | TEAMYG-SERVER 계약. 계약 절은 서버가 정본이고 플랫폼별 매핑은 그 안의 절로 붙는다 |
| [`pm/`](pm/) | **플랫폼 공용** | PRD·포지셔닝·로드맵 등 제품 문서 |
| [`blog/`](blog/) | 공용 | 이 저장소의 작업 방식을 적은 글 |
| [`script/`](script/) | 공용 | 스킬이 호출하는 파이썬 툴링 |
| [`index.md`](index.md) | 공용 | 에이전트 진입 허브. 라우팅은 여기서 본다 |

플랫폼 축이 갈린 이유는 iOS다. 위키는 iOS가 붙어도 그대로 재사용되도록 플랫폼 비종속으로
써 있고(`wiki/CLAUDE.md`), 구현 문서 쪽도 같은 준비를 해 둔다. iOS 문서가 생기면
`parfait/ios/`가 `android/`의 형제로 앉고 `api/`·`pm/`은 양쪽이 공유한다.

## 새 문서를 어디에 둘지

**Android 코드가 근거이거나 Android 코드를 향하는 문서는 `android/` 안으로.** 설계 스펙·구현
계획·아키텍처 결정·구현 미결이 전부 여기다. 판단 기준은 "iOS가 이 문서를 그대로 쓸 수 있는가"다 —
못 쓰면 `android/`다.

**서버가 정본인 것은 `api/`.** 엔드포인트·요청/응답 필드·에러코드는 플랫폼과 무관하게 서버가
정한다. Android가 그것을 어떻게 받는지는 같은 문서의 「Android 매핑」 절에 적는다 — 문서를
`android/`로 옮기지 않는다.

**정책·기획 자체는 여기가 아니라 위키다.** 화면이 무엇을 해야 하는지는 `wiki/`가 적고,
`parfait/`는 그것을 어떻게 만들었는지를 적는다. 의존 방향은 **구현 → 위키 단방향**이다.

## 코드 주석·KDoc 규약

[`android/CLAUDE.md`](android/CLAUDE.md)에 있다. Kotlin 코드에 적용되는 규약이라 Android
범위이고, `android/` 아래 파일을 열면 자동으로 얹힌다.

⚠️ 그 파일은 **TJYG-Android에서 일하는 서브에이전트에게 자동으로 닿지 않는다.** 구현·리뷰
디스패치의 전역 제약과 계획의 Global Constraints에 요지를 실어 날라야 한다.

## 링크 검사

디렉토리를 옮기거나 스펙을 `archive/`로 내리면 상대 링크의 `../` 깊이가 어긋난다.
`python3 parfait/script/check_links.py parfait`로 전수 확인한다(깨진 링크가 있으면 exit 1).
