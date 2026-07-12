---
tags: [spec, parfait, designsystem]
updated: 2026-07-12
---

# Spec: YGListItem

- 상태: 구현 예정
- 날짜: 2026-07-12
- 대상: `core:designsystem` — `component/etc/`
- 관련: [ADR-0010](../adr/0010-custom-compositionlocal-theme.md)(자체 테마) · [design-system](../architecture/design-system.md)(컴포넌트 작성 규약) · 이슈 #136

## 목표
피그마 List-Item 스펙의 리스트 행을 `core:designsystem` 컴포넌트로 만든다. 좌측 텍스트(메인 + 옵션 sub) + 우측 caret 버튼. 메뉴·설정 리스트 항목용.

## 범위
- **포함**: 메인 텍스트, 옵션 sub 텍스트(메인 아래 세로 스택), 옵션 caret(우측 화살표) 버튼, caret 탭 콜백.
- **제외**: 행 전체 clickable(clickable은 caret만), leading 아이콘, 하단 divider 결합([[2026-07-12-yghorizontaldivider|YGHorizontalDivider]] 별도 조합), `Colors`/`Defaults` 색 홀더(직접 파라미터로 대체), Button-Icon 별도 컴포넌트화(현재 인라인, 후속 과제).

## API / 인터페이스
```kotlin
@Composable
fun YGListItem(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    subText: String? = null,
    showSubText: Boolean = false,
    showCaret: Boolean = true,
    textColor: Color = YGAtomicColors.Gray.Gray800,
    subTextColor: Color = YGAtomicColors.Gray.Gray400,
    caretTint: Color = YGAtomicColors.Gray.Gray300,
)
```
- `text`: 메인 텍스트(필수).
- `onClick`: **caret 버튼** 탭 시 호출. 행 전체가 아닌 caret 영역만 클릭 지점. `showCaret = false`면 클릭 지점 없음.
- `subText` / `showSubText`: 둘 다 충족(`showSubText && subText != null`)일 때만 메인 아래 표시. 피그마 기본 `showSubText = false`.
- `showCaret`: 우측 caret 표시 토글. 피그마 기본 `true`.
- `textColor` / `subTextColor` / `caretTint`: 색 오버라이드. 기본은 테마 원자색(피그마 미제공분은 추천 기본값 — 아래 표).

## 동작 / 상태
- 런타임 상태 없음(정적 표시 + caret 탭 콜백). 상태별 색 분기 없음(caret Status는 Default만).
- **구조**: 루트 `Row`(`fillMaxWidth`, `verticalAlignment = CenterVertically`, `horizontalArrangement = spacedBy(layout.gap.gap2)`).
  1. 텍스트 영역 `Column`(weight 1f): 메인 `Text` + 조건부 sub `Text`.
  2. `showCaret`이면 caret `Box`(고정 클릭 박스) + 중앙 `Image`.

| 요소 | 타이포 | 색 | 비고 |
|---|---|---|---|
| 메인 텍스트 | `typography.body.b02R` | `textColor`(기본 `Gray.Gray800`) | 피그마 명시 |
| sub 텍스트 | `typography.caption.c01R` | `subTextColor`(기본 `Gray.Gray400`) | 피그마 미제공 → 추천 기본값 |
| caret 아이콘 | — | `caretTint`(기본 `Gray.Gray300`) | `R.drawable.ic_caret_right`, textfield clear와 동일 톤 |

- **패딩**: `Row`에 `horizontal = layout.padding.padding7`, `vertical = layout.padding.padding2`.
- **caret 배치**: `Box`(`SizeTokens.Size44` clickable, `role = Role.Button`, 탭 시 `onClick()`, `contentAlignment = Center`) 안에 `Image`(`SizeTokens.Size24` 중앙). textfield clear 박스 선례와 동일. → **TODO: Button-Icon 컴포넌트로 교체 예정**(현재 인라인).
- **높이**: 피그마 Hug(52). caret 표시 시 caret `Box`(Size44) + 상하 `padding2`가 높이를 지배(별도 height 지정 없음). caret 없으면 텍스트 높이로 Hug.

## 표시·제어 규칙
- **sub 텍스트**: `showSubText` **AND** `subText != null`.
- **caret**: `showCaret`. 탭 시 `onClick()`.
- 입력 제어 없음(정적).

## 파일 구성 (`component/etc/`)
- `YGListItem.kt` — public `YGListItem` 컴포저블 + `@YGPreview`/`PreviewBox` 프리뷰(caret 유/무·subText 유/무 조합).

## 주의 / 열린 질문
- **sub 텍스트 스타일 미확정**: 피그마가 sub text 타이포/색을 제공하지 않아 `caption.c01R` + `Gray.Gray400`을 잠정 채택. 디자인 확정 시 갱신.
- **과도기**: gray 음영·caret tint가 시맨틱 슬롯 없어 `YGAtomicColors` 직접 참조 — YGButton·YGTextField 선례. → [open-questions 2026-07-10 YGButton 디자인 토큰](../../synthesis/open-questions.md).
- **caret 인라인**: caret이 별도 Button-Icon 컴포넌트가 아니라 인라인 Box+Image(textfield clear와 중복 패턴). 공통 icon-button 컴포넌트가 생기면 양쪽 교체 대상.
