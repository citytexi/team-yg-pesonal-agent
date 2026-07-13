# Architecture Decision Records

이 디렉토리는 Parfait 프로젝트의 주요 아키텍처 결정을 기록합니다.

> ADR 형식: [Michael Nygard의 경량 ADR](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) 기반
>
> 형식 권위 출처: [`template.md`](template.md)

| ADR | Title | Status | Date | Postscript |
|-----|-------|--------|------|-----------|
| [0001](0001-layered-multi-module.md) | 레이어드 다중 모듈 구조 (core/data/domain/feature) | accepted | 2026-04-19 | 의존 단방향 |
| [0002](0002-feature-api-impl-split.md) | feature 모듈을 :api / :impl로 분리 | accepted | 2026-05-19 | feature 간 :api만 참조 |
| [0003](0003-convention-plugins-version-catalog.md) | build-logic 컨벤션 플러그인 + 버전 카탈로그 | accepted | 2026-05-14 | 플러그인 ID `com.teamyg.parfait.plugin.*` |
| [0004](0004-hilt-ksp-di.md) | Hilt + KSP DI, 스코프 분리 | accepted | 2026-05-14 | Singleton / ActivityRetained |
| [0005](0005-custom-mvi-baseviewmodel.md) | 자체 MVI (BaseViewModel<S,I,E>) | accepted | 2026-05-09 | 외부 MVI 프레임워크 미사용 |
| [0006](0006-navigation3-custom-navigator.md) | Navigation3 + 커스텀 Navigator + 엔트리 빌더 | accepted | 2026-05-19 | alpha(ResultEventBus 목적) |
| [0007](0007-compose-material3-design-tokens.md) | Compose + Material3 + 디자인 토큰 | superseded by 0010 | 2026-05-12 | 100% Compose 원칙은 0010에 승계 |
| [0008](0008-datastore-local-persistence.md) | 로컬 영속화 DataStore — Room 미채택 | accepted | 2026-06-10 | 파일+메타 이원 |
| [0009](0009-usecase-injectable-invoke.md) | UseCase = 주입 클래스 + operator invoke | accepted | 2026-06-21 | 인터페이스 없이 |
| [0010](0010-custom-compositionlocal-theme.md) | 자체 CompositionLocal 디자인시스템 테마 | accepted | 2026-07-10 | 0007 대체, MaterialTheme·dynamic color 배제 |
| [0011](0011-cross-module-bitmap-abstraction.md) | 크로스모듈 비트맵 추상화 (BitmapWrapper/AndroidBitmap) | accepted | 2026-07-12 | domain 순수성 유지, 현재 stub |
| [0012](0012-mlkit-subject-segmentation.md) | 이미지 세그멘테이션 — ML Kit Subject Segmentation 온디바이스 | accepted | 2026-07-12 | beta·GMS·install-time 모델 |

## 작성 가이드

- 파일명: `NNNN-kebab-case-title.md` (예: `0001-mvi-store-pattern.md`)
- 번호는 4자리, 순차 증가
- Status: `proposed` / `accepted` / `superseded` / `deprecated`
- 결정이 다른 ADR을 대체하면 Postscript에 supersede 관계 명시
- 새 ADR 추가 시 위 인덱스 테이블에 한 줄 등록 (ADR 파일과 README 인덱스는 같은 커밋)
- 형식 권위 출처: [`template.md`](template.md)

## ⛔ 라인번호·수치 금지 규칙 (가장 중요)

이 wiki는 **"왜 이렇게 결정했는가"(구조 결정)** 만 기록한다. 코드와 함께 바뀌어 금방 거짓이 되는 정보는 **절대 적지 않는다.**

**적지 말 것:**
- **라인번호** — `Store.kt:34`, `:78` 같은 `:NN`. refactor 한 번에 전부 어긋난다.
- **파일/화면 개수** — "화면 74개", "37개 레거시".
- **진행률·비율** — "약 70% 이행".
- **사용 횟수** — "특정 API 206회 호출".
- **빌드 스크립트 라인 번호** — 파일명까지만.

**적을 것 (안정적):**
- **파일명 + 심볼명** — `Store.kt`의 `postState`, `FooRepositoryImpl`의 `flowItems`. 심볼명은 라인보다 훨씬 오래 산다.
- **설계 결정·대안·트레이드오프** — ADR의 본질. 코드가 안 바뀌는 한 유효.
- **방향성** — "A → B로 수렴", 수치 없이.

**현재 수치가 필요하면 코드에서 직접 측정한다** (예시):

```bash
# 화면 수
find . -name '*Screen*.kt' | wc -l
# 특정 API 사용 횟수
grep -rE '\bSomeApi\b' src | wc -l
```

**왜:** 한 번 거짓이 된 수치가 섞이면 문서 전체의 신뢰가 깨진다 — "없는 것보다 못한" 상태. 검증 불가능한 라인번호를 적느니, 검증 가능한 심볼명만 남긴다.
