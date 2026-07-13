# Specs

Parfait 구현 기능·컴포넌트의 **구현 전 설계 스펙**을 모읍니다. (브레인스토밍으로 확정한 요구·API·상태·토큰 매핑을 코드 작성 전에 고정)

> `specs/`는 "무엇을 만들 것인가"(구현 직전 확정 설계)를, `adr/`는 "왜"(구조 결정), `architecture/`는 "어떻게/어디"(상시 구현 가이드), `plans/`는 "작업 순서"를 다룹니다.
>
> **파일명 컨벤션**: `YYYY-MM-DD-kebab-topic.md`. 구현 완료된 스펙은 `archive/`로 이동.
>
> 근거는 파일명 + 심볼명으로. 라인번호·변동 수치·색 hex값은 적지 않습니다(상세 규칙 [`../adr/README.md`](../adr/README.md)).

| 스펙 | 상태 | 내용 |
|------|------|------|
| [2026-07-12-clickableyg-throttle.md](2026-07-12-clickableyg-throttle.md) | 구현 예정 | `core:ui` — clickableYG(Node 기반 leading-throttle 중복 클릭 방지 Modifier, windowMillis 기본 300ms) |
| [2026-07-13-ygripple.md](2026-07-13-ygripple.md) | 구현 예정 | `core:designsystem` — ygRipple(커스텀 dim ripple IndicationNodeFactory, createRippleModifierNode 위임, alpha 0.15, 기본 Gray900) |

## 아카이브
| 스펙 | 내용 |
|------|------|
| [2026-07-10-ygtextfield.md](archive/2026-07-10-ygtextfield.md) | `component/textfield` — YGTextField(단일 폼, idle/focused/error/disabled 런타임 상태) |
| [2026-07-10-ygtextformfield.md](archive/2026-07-10-ygtextformfield.md) | `component/textfield` — YGTextFormField(YGTextFieldImpl 재사용 + 하단 errorDescription) |
| [2026-07-12-yghorizontaldivider.md](archive/2026-07-12-yghorizontaldivider.md) | `component/etc` — YGHorizontalDivider(1dp 수평 구분선, Spacer 기반, 두께·색 오버라이드) |
| [2026-07-12-yglistitem.md](archive/2026-07-12-yglistitem.md) | `component/etc` — YGListItem(메인+옵션 sub 텍스트 + 옵션 trailing 아이콘 버튼, 아이콘만 clickable) |
| [2026-07-12-ygiconbutton.md](archive/2026-07-12-ygiconbutton.md) | `component/ygiconbutton` — YGIconButton(재사용 아이콘 버튼, 크기 프리셋 SIZE_44/48, enabled/pressed tint) + YGIconButtonSize enum. 인라인 아이콘 버튼 공통화 |
| [2026-07-12-ygactionitem.md](archive/2026-07-12-ygactionitem.md) | `component/ygactionitem` — YGActionItem(텍스트 액션 항목, pressed 색, Role.Button) |
| [2026-07-12-ygtextfield-clear-iconbutton.md](archive/2026-07-12-ygtextfield-clear-iconbutton.md) | `component/textfield` — YGTextField clear 버튼 인라인 Box+Image → YGIconButton 교체(clearIconTint 제거). FormField 무편집 반사 반영 |
| [2026-07-12-yglistitem-trailingicon-iconbutton.md](archive/2026-07-12-yglistitem-trailingicon-iconbutton.md) | `component/etc` — YGListItem trailing 아이콘 인라인 Box+Image → YGIconButton 교체(trailingIconColor 제거). clear 교체에 이은 두 번째 통일 |

## 작성 가이드
- 형식 권위 출처: [`template.md`](template.md)
- 새 스펙 = 위 인덱스 테이블에 한 줄 등록(스펙 파일과 README는 같은 커밋)
- 스펙이 새 아키텍처 결정을 유발하면 대응 ADR을 함께 만든다([`../adr/`](../adr/README.md))
