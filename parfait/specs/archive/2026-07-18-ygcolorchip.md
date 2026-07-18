---
id: ygcolorchip
title: 컬러칩(네임태그 원형) (YGColorChip)
status: implemented
category: ui-spec
platforms: android
verified: 2026-07-18
related_code: YGColorChip.kt#YGColorChip, YGColorChip.kt#YGColorChipStyle, YGColorChipType.kt#YGColorChipType, YGColorChipPreviewData.kt#YGColorChipPreviewParameterProvider
related_adr: ADR-0010
related_spec:
related_architecture: design-system
supersedes:
superseded_by:
tags: [spec, parfait, designsystem]
---

# Spec: 컬러칩(네임태그 원형) (YGColorChip)

- 대상: `core:designsystem` — `component/ygcolorchip/`
- 관련: [ADR-0010](../../adr/0010-custom-compositionlocal-theme.md)(자체 테마) · [design-system](../../architecture/design-system.md) · PR #150(`feature/design-system-component-colorchip`) · 위키 정책 [[nametag-chip]]

> 상태·날짜·대상·관련은 위 frontmatter가 단일 출처. 본문은 설계 내용에 집중.

## 목표
닉네임 첫 글자를 담는 원형 컬러칩(네임태그). 타입별로 채움/테두리/글자 색이 정해지고, 두 크기 스타일을 지원한다. 그룹 멤버 표시·프로필 원형 등이 유스케이스(위키 [[nametag-chip]] 정책의 구현체).

## 범위
- 포함: 원형 칩 렌더(채움+테두리+중앙 텍스트), 타입별 색 매핑(`YGColorChipType`), 크기 스타일(`YGColorChipStyle`), 타입 프리뷰.
- 제외:
  - 표시 문자 생성(닉네임 첫 글자 추출 등) — 호출자 소유. `text` 완성 문자열만 받는다.
  - 타입↔멤버 매핑 규칙 — 위키 정책([[nametag-chip]]/[[S-101-프로필-닉네임-컬러-규칙-v0.2]]) 소관. 컴포넌트는 `YGColorChipType`만 받는다.

## API / 인터페이스
```kotlin
sealed interface YGColorChipStyle {
    val colorChipSize: Dp
    val colorChipWidth: Dp          // 테두리 두께
    val textStyle: TextStyle @Composable get
    data object Style28 : YGColorChipStyle   // caption.c01R
    data object Style40 : YGColorChipStyle   // body.b01R
}

sealed interface YGColorChipType {
    val fillColor: Color
    val strokeColor: Color
    val textColor: Color
    // NametagChip1 ~ NametagChip13, NametagChipPlus
}

@Composable
fun YGColorChip(
    colorChipType: YGColorChipType,
    text: String,
    chip: YGColorChipStyle,
    modifier: Modifier = Modifier,
)
```
- `colorChipType`: 채움/테두리/글자 색 묶음(`YGColorChipType` 변형). 호출자 주입.
- `text`: 칩 중앙 표시 문자. 호출자 주입.
- `chip`: 크기 스타일(`Style28`/`Style40`) — 지름·테두리 두께·텍스트 스타일 결정.
- `modifier`: 기본 `Modifier`.

## 동작 / 상태
- Stateless presentational. 상호작용(클릭·pressed) 없음 — 순수 표시.
- 원형: `clip(CircleShape)` + `background(fillColor)` + `border(colorChipWidth, strokeColor, CircleShape)`, 중앙 정렬 `Text(text, textColor, textStyle)`.

### 스타일 매핑
| 스타일 | 지름 | 테두리 두께 | 텍스트 스타일 |
|--------|------|-------------|----------------|
| `Style28` | `colorChipSize`(28dp급) | `colorChipWidth`(가는) | `YGTheme.typography.caption.c01R` |
| `Style40` | `colorChipSize`(40dp급) | `colorChipWidth` | `YGTheme.typography.body.b01R` |

### 타입 매핑
- `NametagChip1`~`NametagChip13` + `NametagChipPlus`(멤버 추가용 "+" 등). 각 변형이 `fillColor`/`strokeColor`/`textColor`를 `YGAtomicColors`(Cherry/Melon/Pudding/Gray 계열)로 고정. 실색 값은 코드(`YGColorChipType.kt`)에서 확인.

## 파일 구성
- `component/ygcolorchip/YGColorChip.kt` — public `YGColorChip` + `YGColorChipStyle`.
- `component/ygcolorchip/YGColorChipType.kt` — `YGColorChipType` 색 매핑.
- `component/ygcolorchip/YGColorChipPreviewData.kt` — 프리뷰 데이터(`YGChipPreviewData`) + `YGColorChipPreviewParameterProvider`.
- 프리뷰: `@Preview` + `YGCustomTheme` + `@PreviewParameter`(타입 전수).

## 주의 / 열린 질문
- **⚠️ 패키지↔폴더 불일치(코드 결함)**: 세 파일이 `component/ygcolorchip/` 폴더에 있으나, `YGColorChip.kt`·`YGColorChipPreviewData.kt`는 `package ...component.ygchip`, `YGColorChipType.kt`만 `package ...component.ygcolorchip`로 선언 — 폴더와 패키지가 어긋남. → [open-questions](../../open-questions.md).
- **⚠️ 타입 개수 정책 드리프트**: 코드는 `NametagChip1~13` + `Plus` = **14종**. 위키 정책 [[nametag-chip]]([[S-101-프로필-닉네임-컬러-규칙-v0.2]])은 **Nametag-Chip 12종**으로 기술. 개수·매핑 불일치 → [open-questions](../../open-questions.md) + 위키 정책 재확인 필요.
- **원자 색 직접 참조(과도기)**: 타입 색이 시맨틱(`YGTheme.colorScheme`) 대신 `YGAtomicColors` 직접 참조. 설계 전반 과도기 패턴 → [design-system](../../architecture/design-system.md).
