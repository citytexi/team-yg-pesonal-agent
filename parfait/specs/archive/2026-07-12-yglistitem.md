---
tags: [spec, parfait, designsystem]
updated: 2026-07-12
---

# Spec: YGListItem

- 상태: 구현 완료
- 날짜: 2026-07-12
- 대상: `core:designsystem` — `component/etc/`
- 관련: [ADR-0010](../../adr/0010-custom-compositionlocal-theme.md)(자체 테마) · [design-system](../../architecture/design-system.md)(컴포넌트 작성 규약) · 이슈 #136

## 목표
피그마 List-Item 스펙의 리스트 행을 `core:designsystem` 컴포넌트로 만든다. 좌측 메인 텍스트 + 우측 옵션 sub 텍스트(값) + 우측 옵션 trailing 아이콘 버튼. 메뉴·설정 리스트 항목용.

## 범위
- **포함**: 메인 텍스트, 옵션 sub 텍스트(메인 우측 값 텍스트), 옵션 trailing 아이콘(우측, 임의 `@DrawableRes`) 버튼, trailing 아이콘 탭 콜백.
- **제외**: 행 전체 clickable(clickable은 trailing 아이콘만), leading 아이콘, 하단 divider 결합([[2026-07-12-yghorizontaldivider|YGHorizontalDivider]] 별도 조합), `Colors`/`Defaults` 색 홀더(직접 파라미터로 대체), Button-Icon 별도 컴포넌트화(현재 인라인, 후속 과제).

## API / 인터페이스
```kotlin
@Composable
fun YGListItem(
    text: String,
    modifier: Modifier = Modifier,
    subText: String? = null,
    @DrawableRes trailingIcon: Int? = null,
    textColor: Color = YGAtomicColors.Gray.Gray800,
    subTextColor: Color = YGAtomicColors.Gray.Gray400,
    trailingIconColor: Color = YGAtomicColors.Gray.Gray300,
    onClick: () -> Unit = {},
)
```
- `text`: 메인 텍스트(필수).
- `subText`: null이 아니면 메인 우측에 값 텍스트로 표시. 기본 `null`(미표시).
- `trailingIcon`: null이 아니면 우측 trailing 아이콘 버튼 표시(예: `R.drawable.ic_caret_right`). 기본 `null`(미표시).
- `onClick`: **trailing 아이콘 버튼** 탭 시 호출. 행 전체가 아닌 아이콘 영역만 클릭 지점. `trailingIcon == null`이면 클릭 지점 없음. 기본 `{}`.
- `textColor` / `subTextColor` / `trailingIconColor`: 색 오버라이드. 기본은 테마 원자색(피그마 미제공분은 추천 기본값 — 아래 표).

## 동작 / 상태
- 런타임 상태 없음(정적 표시 + 아이콘 탭 콜백). 상태별 색 분기 없음.
- **구조**: 루트 `Row`(`fillMaxWidth`, `verticalAlignment = CenterVertically`, `horizontalArrangement = spacedBy(layout.gap.gap2)`). 자식은 가로 배치.
  1. 메인 `Text`(`weight 1f`) — 남는 폭 차지, sub/아이콘을 우측으로 밀어냄.
  2. `subText != null`이면 sub `Text`(메인 우측 값).
  3. `trailingIcon != null`이면 아이콘 `Box`(고정 클릭 박스) + 중앙 `Image`.

| 요소 | 타이포 | 색 | 비고 |
|---|---|---|---|
| 메인 텍스트 | `typography.body.b02R` | `textColor`(기본 `Gray.Gray800`) | 피그마 명시 |
| sub 텍스트 | `typography.body.b02SB` | `subTextColor`(기본 `Gray.Gray400`) | 우측 값 텍스트, 세미볼드 |
| trailing 아이콘 | — | `trailingIconColor`(기본 `Gray.Gray300`) | 임의 `@DrawableRes`, textfield clear와 동일 톤 |

- **패딩**: `Row`에 `horizontal = layout.padding.padding7`, `vertical = layout.padding.padding2`.
- **아이콘 배치**: `Box`(`SizeTokens.Size44` clickable, `role = Role.Button`, 탭 시 `onClick()`, `contentAlignment = Center`) 안에 `Image`(`SizeTokens.Size24` 중앙). textfield clear 박스 선례와 동일. → **TODO: Button-Icon 컴포넌트로 교체 예정**(현재 인라인).
- **높이**: 피그마 Hug. 아이콘 표시 시 아이콘 `Box`(Size44) + 상하 `padding2`가 높이를 지배(별도 height 지정 없음). 아이콘 없으면 텍스트 높이로 Hug.

## 표시·제어 규칙
- **sub 텍스트**: `subText != null`.
- **trailing 아이콘**: `trailingIcon != null`. 탭 시 `onClick()`.
- 입력 제어 없음(정적).

## 파일 구성 (`component/etc/`)
- `YGListItem.kt` — public `YGListItem` 컴포저블 + `@YGPreview`/`PreviewBox` 프리뷰(trailing 아이콘 유/무·subText 유/무 조합).

## 주의 / 열린 질문
- **sub 텍스트 스타일**: 우측 값 텍스트로 `body.b02SB` + `Gray.Gray400` 채택. 피그마 확정본과 어긋나면 갱신.
- **과도기**: gray 음영·아이콘 tint가 시맨틱 슬롯 없어 `YGAtomicColors` 직접 참조 — YGButton·YGTextField 선례. → [open-questions 2026-07-10 YGButton 디자인 토큰](../../../synthesis/open-questions.md).
- **아이콘 인라인**: trailing 아이콘이 별도 Button-Icon 컴포넌트가 아니라 인라인 Box+Image(textfield clear와 중복 패턴). 공통 icon-button 컴포넌트가 생기면 양쪽 교체 대상.
