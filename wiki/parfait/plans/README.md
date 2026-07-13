# Plans

Parfait 프로젝트의 작업 계획 문서를 모읍니다.

> **참고** — 파일명 컨벤션: `YYYY-MM-DD-kebab-case-topic.md`. 완료/폐기된 계획은 `archive/` 하위로 이동합니다.

| 계획 | 내용 |
|------|------|
| [2026-07-12-clickableyg-throttle.md](2026-07-12-clickableyg-throttle.md) | clickableYG 구현 계획(core:designsystem utils/clickable, Modifier.Node leading-throttle: Element+Node, delegated pointer-input/indication/semantics, TimeSource.Monotonic, indication 기본 ygDimRipple). 미구현. 스펙: [specs](../specs/2026-07-12-clickableyg-throttle.md) |
| [2026-07-13-ygripple.md](2026-07-13-ygripple.md) | ygDimRipple 구현 계획(core:designsystem utils/clickable, 커스텀 dim ripple IndicationNodeFactory, createRippleModifierNode 위임). 미구현. 스펙: [specs](../specs/2026-07-13-ygripple.md) |
| [2026-07-13-clickableyg-ripple-variants.md](2026-07-13-clickableyg-ripple-variants.md) | clickableYG 리플 변형(Dim/Scale/Merge, non-composable, indications 리스트) + ygScaleRipple 구현 계획(3 Task). 미구현. 스펙: [specs](../specs/2026-07-13-clickableyg-ripple-variants.md) |

## 아카이브
| 계획 | 내용 |
|------|------|
| [2026-07-10-ygtextfield.md](archive/2026-07-10-ygtextfield.md) | YGTextField 구현 계획(component/textfield). 구현 완료. 스펙: [specs](../specs/archive/2026-07-10-ygtextfield.md) |
| [2026-07-10-ygtextformfield.md](archive/2026-07-10-ygtextformfield.md) | YGTextFormField 구현 계획(YGTextFieldImpl 재사용 + errorDescription). 구현 완료. 스펙: [specs](../specs/archive/2026-07-10-ygtextformfield.md) |
| [2026-07-12-yghorizontaldivider.md](archive/2026-07-12-yghorizontaldivider.md) | YGHorizontalDivider 구현 계획(component/etc, Spacer 1dp 수평선). 구현 완료. 스펙: [specs](../specs/archive/2026-07-12-yghorizontaldivider.md) |
| [2026-07-12-yglistitem.md](archive/2026-07-12-yglistitem.md) | YGListItem 구현 계획(component/etc, Row 가로: 메인+옵션 sub+옵션 trailing 아이콘 Box). 구현 완료. 스펙: [specs](../specs/archive/2026-07-12-yglistitem.md) |
| [2026-07-12-ygiconbutton.md](archive/2026-07-12-ygiconbutton.md) | YGIconButton 구현 계획(component/ygiconbutton, Box+Image tint, 크기 enum, PreviewParameterProvider). 구현 완료(사후 기록). 스펙: [specs](../specs/archive/2026-07-12-ygiconbutton.md) |
| [2026-07-12-ygactionitem.md](archive/2026-07-12-ygactionitem.md) | YGActionItem 구현 계획(component/ygactionitem, Box+Text, pressed 색, Role.Button). 구현 완료(사후 기록). 스펙: [specs](../specs/archive/2026-07-12-ygactionitem.md) |
| [2026-07-12-ygtextfield-clear-iconbutton.md](archive/2026-07-12-ygtextfield-clear-iconbutton.md) | YGTextField clear→YGIconButton 교체(component/textfield, 2 Task: Impl 교체 → clearIconTint 제거). 구현 완료(코드는 별도 커밋 예정). 스펙: [specs](../specs/archive/2026-07-12-ygtextfield-clear-iconbutton.md) |
| [2026-07-12-yglistitem-trailingicon-iconbutton.md](archive/2026-07-12-yglistitem-trailingicon-iconbutton.md) | YGListItem trailing 아이콘→YGIconButton 교체(component/etc, 1 Task: 블록 치환 + trailingIconColor 제거). 구현 완료(compile·ktlint 통과, 코드는 별도 커밋 예정). 스펙: [specs](../specs/archive/2026-07-12-yglistitem-trailingicon-iconbutton.md) |
| [2026-07-13-yginputnumber.md](archive/2026-07-13-yginputnumber.md) | YGInputNumber 구현 계획(component/yginputnumber, 50×50 선택 셀). 사후 기록(develop #129 머지 완료). 스펙: [specs](../specs/archive/2026-07-13-yginputnumber.md) |
