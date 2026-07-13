---
id: open-questions
title: Open Questions — 구현 미결·열린 결정
category: meta
status: living
platforms: android
verified: 2026-07-13
related_spec:
related_adr: ADR-0010, ADR-0011, ADR-0012
related_architecture: design-system, data-layer
related_code:
tags: [meta, parfait]
---
# Open Questions — 구현 미결·열린 결정

TJYG-Android 구현에서 발견된 미결 결정·계약 공백·코드/문서 정합 이슈를 추적한다.
정책 기획 쪽 미결은 위키 [[open-questions]]에 있다. 여기는 **코드·ADR·architecture 소관**만 둔다.
해소된 항목은 상태를 "해소됨"으로 바꾸고 관련 ADR/architecture 문서에 반영한다.

> 링크 규약: parfait 내부 문서는 상대 md 링크(`adr/…`, `architecture/…`). 위키 개념 참조만 `[[…]]`.

---

### [2026-07-10] YGButton 디자인 토큰 규칙 미확정
- **출처**: `component/ygbutton/YGButtonType.kt` — 각 변형 `colors`가 시맨틱(`YGTheme.colorScheme`) 대신 `YGAtomicColors`를 직접 참조, 값 잠정(mock). 코드 주석 "Design Token 규칙이 조금 이상… 컴포넌트 완성 시점에 문의 예정".
- **항목**: ① 컴포넌트가 원자 색을 직접 읽는 것을 시맨틱 계층으로 정리할지, ② XSmall/Small/… 변형별 패딩·radius·textStyle 토큰 매핑 확정.
- **상태**: 미해결
- **해소 메모**: 컴포넌트 완성·디자인 토큰 규칙 확정 시 [design-system](architecture/design-system.md) 규약과 [ADR-0010](adr/0010-custom-compositionlocal-theme.md) 원칙(시맨틱 우선)에 맞춰 정리.

### [2026-07-12] BitmapWrapper stub — 계약 없는 추상
- **출처**: `core/util/jvm`의 `BitmapWrapper`(멤버 없음, `// TODO 차후 비트맵 사용에 필요한 함수 구현`), `core/util/android`의 `AndroidBitmap`(`// TODO delegate 사용하도록 수정`).
- **항목**: ① 도메인이 비트맵에 필요한 연산을 `BitmapWrapper` 계약으로 정의할지(현재는 `data`에서 `as? AndroidBitmap` 다운캐스트에 의존), ② `getRawData()` 직접 노출을 유지할지.
- **상태**: 미해결
- **해소 메모**: 필요한 연산 확정 시 [ADR-0011](adr/0011-cross-module-bitmap-abstraction.md) 본문·`BitmapWrapper`에 반영해 다운캐스트 의존을 줄인다.

### [2026-07-12] ML Kit Subject Segmentation beta 의존
- **출처**: `gradle/libs.versions.toml`의 `mlkitSubjectSegmentation`(beta), `feature/segmentation/impl`의 `AndroidManifest` install-time 모델. [ADR-0012](adr/0012-mlkit-subject-segmentation.md).
- **항목**: ① beta 승급·API 변동 추적, ② GMS 미탑재 기기 대응, ③ subject PNG 캐시 파일(`cacheDir`) 정리 정책, ④ [[누끼-따기]] "온디바이스 vs 서버" 미결의 온디바이스 잠정 확정 여부.
- **상태**: 보류 (온디바이스로 잠정 채택, beta 추적 중)
- **해소 메모**: 정식(GA) 승급 시 버전 고정·문서 갱신. 캐시 정리 정책 정하면 [data-layer](architecture/data-layer.md) 갱신.

### [2026-07-12] 세그멘테이션 예외 처리 불일치
- **출처**: `data`의 `ImageSegmentationRepositoryImpl.segmentImage` — `Result<SegmentationResult>`/`SegmentationException` 패턴을 쓰면서도 `foregroundConfidenceMask`가 null이면 `error("...")`(raw `IllegalStateException`)로 throw. Result로 감싸지 않아 호출부(effect→Toast)가 못 잡을 수 있음.
- **항목**: null 마스크·`Tasks.await` 예외를 `SegmentationException`(예: 신규 케이스)으로 통합해 `Result.failure`로 반환할지.
- **상태**: 미해결
- **해소 메모**: 코드 수정 대상(문서 아님). 처리 방식 확정 시 [ADR-0012](adr/0012-mlkit-subject-segmentation.md) "위험·방어"와 정합 확인.

### [2026-07-12] 디자인시스템 컴포넌트 컨벤션 분기
- **출처 A**: `component/ygbutton`·`ygiconbutton`·`ygactionitem` — 컴포넌트별 폴더 + `@Preview`/`YGCustomTheme`(+`PreviewParameterProvider`) 프리뷰.
- **출처 B**: `component/textfield`·`etc` — 그룹 폴더 + `@YGPreview`/`PreviewBox` 프리뷰.
- **항목**: ① 패키지 네이밍(컴포넌트별 vs 그룹 폴더) 표준, ② 프리뷰 방식(`@YGPreview`/`PreviewBox` vs `@Preview`/`PreviewParameterProvider`) 표준.
- **상태**: 미해결
- **해소 메모**: 표준 확정 시 [design-system](architecture/design-system.md) "컴포넌트 작성 규약"에 반영하고 기존 컴포넌트 정리.

<!--
항목 추가 형식:

### [YYYY-MM-DD] [주제 요약]
- **출처**: `경로/파일` — 근거 (라인번호·변동수치 금지, 파일명+심볼명)
- **항목**: 결정해야 할 것
- **상태**: 미해결 | 해소됨 | 보류
- **해소 메모**: 해소 시 어느 ADR/architecture에 반영했는지
-->
