---
id: ygtext-date-label
title: 텍스트 프리셋 (YGDate / YGLabel)
status: implemented
category: ui-spec
platforms: android
verified: 2026-07-18
related_code: YGDate.kt#YGDate, YGLabel.kt#YGLabel
related_adr: ADR-0010
related_spec:
related_architecture: design-system
supersedes:
superseded_by:
tags: [spec, parfait, designsystem]
---

# Spec: 텍스트 프리셋 (YGDate / YGLabel)

- 대상: `core:designsystem` — `component/ygtext/`
- 관련: [ADR-0010](../../adr/0010-custom-compositionlocal-theme.md)(자체 테마) · [design-system](../../architecture/design-system.md) · PR #150(`feature/design-system-component-colorchip`)

> 상태·날짜·대상·관련은 위 frontmatter가 단일 출처. 본문은 설계 내용에 집중.

## 목표
자주 쓰는 텍스트 스타일 두 종을 미리 묶은 얇은 래퍼. 타이포·색을 매번 지정하지 않도록 프리셋으로 노출한다.
- `YGDate`: 파르페 날짜 라벨("N월 N일의 파르페" 등).
- `YGLabel`: 보조 라벨(폼 필드 라벨 등).

## 범위
- 포함: `Text` + 고정 타이포/색 매핑, 프리뷰.
- 제외: 문자열 생성·포매팅(날짜 포맷 등) — 호출자 소유. 완성 문자열만 받는다.

## API / 인터페이스
```kotlin
@Composable
fun YGDate(text: String, modifier: Modifier = Modifier)

@Composable
fun YGLabel(text: String, modifier: Modifier = Modifier)
```
- `text`: 표시 문자열. 호출자 주입.
- `modifier`: 기본 `Modifier`.

## 레이아웃 / 토큰 매핑 (심볼명)
| 컴포넌트 | 타이포 | 색 | 패딩 |
|----------|--------|-----|------|
| `YGDate` | `YGTheme.typography.body.b02R` | `YGAtomicColors.Gray.Gray600` | 가로 12dp / 세로 8dp **하드코딩** |
| `YGLabel` | `YGTheme.typography.body.b02R` | `YGAtomicColors.Gray.Gray400` | 없음(`modifier` 위임) |

## 파일 구성
- `component/ygtext/YGDate.kt` — public `YGDate`.
- `component/ygtext/YGLabel.kt` — public `YGLabel`.
- 프리뷰: 각 파일 `@Preview` + `YGCustomTheme`.

## 주의 / 열린 질문
- **`YGDate` 패딩 하드코딩**: `padding(horizontal = 12.dp, vertical = 8.dp)` — 레이아웃 토큰(`YGTheme.layout.padding.*`) 미사용. `YGInputNumber`(고정 dp)와 같은 토큰화 예외 사례. 토큰 치환 여부 → [design-system](../../architecture/design-system.md) 검토.
- **원자 색 직접 참조(과도기)**: `YGAtomicColors.Gray.*` 직접 참조(시맨틱 미경유).
