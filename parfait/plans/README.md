# Plans

Parfait 프로젝트의 작업 계획 문서를 모읍니다.

> **참고** — 파일명 컨벤션: `YYYY-MM-DD-kebab-case-topic.md`. 완료/폐기된 계획은 `archive/` 하위로 이동합니다.

| 계획 | 내용 |
|------|------|
| [2026-07-20-s004-terms-privacy-webview.md](2026-07-20-s004-terms-privacy-webview.md) | `:feature:app:setting:impl` — S-004 약관/개인정보 화면 분리 구현(7 Task: NotionWebView+strings → ServiceTerms VM → PrivacyPolicy VM → ServiceTermsScreen → PrivacyPolicyScreen → TermsRoute배선+PrivacyPolicyRoute신규 → EntryBuilder 분리). MVI BaseViewModel, YGTopBarDetail 재사용, WebView(AndroidView) 로딩/에러 폴백, url은 State placeholder(추후 UseCase 주입). 테스트 없음(compile+ktlint+에뮬). 스펙: [specs](../specs/2026-07-20-s004-terms-privacy-webview.md) |

## 아카이브
| 계획 | 내용 |
|------|------|
| [2026-07-19-app-setting-s001.md](archive/2026-07-19-app-setting-s001.md) | `:feature:app:setting` — S-001 앱 설정 화면 구현(7 Task: NavKey3 → ViewModel/State → strings+ProfileCard → Screen → Route배선 → stub Route → EntryBuilder). MVI BaseViewModel, YGListItem·YGTopBarBack 재사용, 계정/약관/개인정보 nav stub. 테스트 없음(compile+ktlint+프리뷰 검증). **develop 머지(#160)**. ProfileCard 각짐만 `RectangleShape` 대체. 스펙: [specs](../specs/archive/2026-07-19-app-setting-s001.md) |
| [2026-07-18-designsystem-preview-migration.md](archive/2026-07-18-designsystem-preview-migration.md) | 프리뷰 관용구 통일 계획(4 Task: 파일럿 YGColorChip → param 5파일 → 무param 6파일 → 검증+문서). `@YGPreview`+`PreviewBox` 전환. **develop 머지(#158)**. 스펙: [specs](../specs/archive/2026-07-18-designsystem-preview-migration.md) |
| [2026-07-14-yginvitecard.md](archive/2026-07-14-yginvitecard.md) | YGInviteCard 구현 계획(component/card, Column+라벨 Row+코드박스 Row, Active/Invalid when 분기, YGButton SmallSquare 재사용, @YGPreview). **develop 머지(#148/#136)**. 스펙: [specs](../specs/archive/2026-07-14-yginvitecard.md) |
| [2026-07-15-ygmodalpopup.md](archive/2026-07-15-ygmodalpopup.md) | YGModalPopup 구현 계획(component/modal, Dialog 래퍼 + private YGModalPopupContent 분리, Contents Column[아이콘+텍스트]+Action Row[확인 Secondary/취소 Primary weight1f], iconTint 기본 cherry-600, @YGPreview는 content 직접 렌더). **develop 머지(#151/#135)**. 스펙: [specs](../specs/archive/2026-07-15-ygmodalpopup.md) |
| [2026-07-10-ygtextfield.md](archive/2026-07-10-ygtextfield.md) | YGTextField 구현 계획(component/textfield). 구현 완료. 스펙: [specs](../specs/archive/2026-07-10-ygtextfield.md) |
| [2026-07-10-ygtextformfield.md](archive/2026-07-10-ygtextformfield.md) | YGTextFormField 구현 계획(YGTextFieldImpl 재사용 + errorDescription). 구현 완료. 스펙: [specs](../specs/archive/2026-07-10-ygtextformfield.md) |
| [2026-07-12-yghorizontaldivider.md](archive/2026-07-12-yghorizontaldivider.md) | YGHorizontalDivider 구현 계획(component/etc, Spacer 1dp 수평선). 구현 완료. 스펙: [specs](../specs/archive/2026-07-12-yghorizontaldivider.md) |
| [2026-07-12-yglistitem.md](archive/2026-07-12-yglistitem.md) | YGListItem 구현 계획(component/etc, Row 가로: 메인+옵션 sub+옵션 trailing 아이콘 Box). 구현 완료. 스펙: [specs](../specs/archive/2026-07-12-yglistitem.md) |
| [2026-07-12-ygiconbutton.md](archive/2026-07-12-ygiconbutton.md) | YGIconButton 구현 계획(component/ygiconbutton, Box+Image tint, 크기 enum, PreviewParameterProvider). 구현 완료(사후 기록). 스펙: [specs](../specs/archive/2026-07-12-ygiconbutton.md) |
| [2026-07-12-ygactionitem.md](archive/2026-07-12-ygactionitem.md) | YGActionItem 구현 계획(component/ygactionitem, Box+Text, pressed 색, Role.Button). 구현 완료(사후 기록). 스펙: [specs](../specs/archive/2026-07-12-ygactionitem.md) |
| [2026-07-12-ygtextfield-clear-iconbutton.md](archive/2026-07-12-ygtextfield-clear-iconbutton.md) | YGTextField clear→YGIconButton 교체(component/textfield, 2 Task: Impl 교체 → clearIconTint 제거). 구현 완료(코드는 별도 커밋 예정). 스펙: [specs](../specs/archive/2026-07-12-ygtextfield-clear-iconbutton.md) |
| [2026-07-12-yglistitem-trailingicon-iconbutton.md](archive/2026-07-12-yglistitem-trailingicon-iconbutton.md) | YGListItem trailing 아이콘→YGIconButton 교체(component/etc, 1 Task: 블록 치환 + trailingIconColor 제거). 구현 완료(compile·ktlint 통과, 코드는 별도 커밋 예정). 스펙: [specs](../specs/archive/2026-07-12-yglistitem-trailingicon-iconbutton.md) |
| [2026-07-13-yginputnumber.md](archive/2026-07-13-yginputnumber.md) | YGInputNumber 구현 계획(component/yginputnumber, 50×50 선택 셀). 사후 기록(develop #129 머지 완료). 스펙: [specs](../specs/archive/2026-07-13-yginputnumber.md) |
| [2026-07-12-clickableyg-throttle.md](archive/2026-07-12-clickableyg-throttle.md) | clickableYG 구현 계획(표준 clickable 위 throttle, @Composable, `core:util:android`). **develop 머지(#143)** — 코드블록은 역사 스냅샷. 스펙: [specs](../specs/archive/2026-07-12-clickableyg-throttle.md) |
| [2026-07-13-ygripple.md](archive/2026-07-13-ygripple.md) | ygDimRipple 구현 계획(커스텀 dim ripple IndicationNodeFactory, createRippleModifierNode 위임). **develop 머지(#143)**, `core:util:android clickable/`. 스펙: [specs](../specs/archive/2026-07-13-ygripple.md) |
| [2026-07-13-clickableyg-ripple-variants.md](archive/2026-07-13-clickableyg-ripple-variants.md) | clickableYG 리플 변형(Dim/Scale/Merge) + ygScaleRipple 구현 계획(@Composable, 합성 indication, `core:util:android`). **develop 머지(#143)**. 스펙: [specs](../specs/archive/2026-07-13-clickableyg-ripple-variants.md) |

## Frontmatter (필수)
모든 plan은 YAML frontmatter를 단다(형식 권위: [`template.md`](template.md)). 필드: `id`(slug) · `title` · `status`(**draft / in-progress / done / abandoned / superseded**) · `type`(work-order / handoff) · `created` · `updated` · `platforms`(=android) · `owner`(**실명 금지**) · `related_adr` · `related_spec` · `related_code`(심볼명, 라인번호 금지) · `archived_reason` · `tags`. 완료/폐기 시 `archive/`로 이동.
