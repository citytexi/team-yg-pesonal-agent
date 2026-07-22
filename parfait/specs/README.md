# Specs

Parfait 구현 기능·컴포넌트의 **구현 전 설계 스펙**을 모읍니다. (브레인스토밍으로 확정한 요구·API·상태·토큰 매핑을 코드 작성 전에 고정)

> `specs/`는 "무엇을 만들 것인가"(구현 직전 확정 설계)를, `adr/`는 "왜"(구조 결정), `architecture/`는 "어떻게/어디"(상시 구현 가이드), `plans/`는 "작업 순서"를 다룹니다.
>
> **파일명 컨벤션**: `YYYY-MM-DD-kebab-topic.md`. 구현 완료된 스펙은 `archive/`로 이동.
>
> 근거는 파일명 + 심볼명으로. 라인번호·변동 수치·색 hex값은 적지 않습니다(상세 규칙 [`../adr/README.md`](../adr/README.md)).

| 스펙 | 상태 | 내용 |
|------|------|------|
| [2026-07-22-s002-account-info.md](2026-07-22-s002-account-info.md) | draft | `feature/app/setting/impl`(route/screen/viewmodel) + `domain` + `core:ui` — S-002 계정 정보 화면(AccountInfo). S-001에서 만든 Route stub·entry·NavKey 본문 채움. MVI + 공유 `CheckNameValidUseCase`에 `CheckEmpty` 규칙 선두 추가(4케이스=위키 정책 이미지 일치)·입력 시 실시간 검증·YGTextFormField(maxLength 15)·YGDangerZone(로그아웃/탈퇴). **i18n 리팩터([ADR-0016](../adr/0016-domain-result-presentation-string-mapping.md))**: NicknameResult sealed 전환·에러 문자열 core:ui `toStringResource`+strings.xml로 이동(S-102 동반 리팩터). 저장 API·로그아웃/탈퇴는 미연동(Intent만 정의, VM stub). 유효성 [[S-002-앱닉네임-정책-v0.1]] 일치 |

## 아카이브
| 스펙 | 내용 |
|------|------|
| [2026-07-22-vendor-android-kotlin-skills.md](archive/2026-07-22-vendor-android-kotlin-skills.md) | **하니스/툴링**(워크플로 A 복무) — android/Kotlin/skydoves/chrisbanes 4repo **73스킬**을 `.claude/skills/`에 전량 벤더링 + `skill-finder`(경량 검색, spec/plan 적재적소) + `update-injected-skills`(baseline SHA+diff 업데이트) + CLAUDE.md 라우팅. C안(네이티브73+경량search). 로직 `parfait/script/`. **구현 완료(inline 실행)** |
| [2026-07-22-intro-term-agree.md](archive/2026-07-22-intro-term-agree.md) | `feature/intro/impl termagree/` — 온보딩 약관 동의 화면(TermAgree). MVI, 필수 약관 리스트(서비스 이용약관·개인정보 처리방침)·개별/전체 토글·필수 충족 시 확인 활성·항목별 상세 랜딩 콜백. YGTopBarBack·YGButton 재사용. **develop 머지(#153)** 사후 기록. 미구현: 동의 저장·랜딩 URL 실값·다음 네비게이션(TODO 3종) |
| [2026-07-22-s102-group-nickname.md](archive/2026-07-22-s102-group-nickname.md) | `feature/groups/enter` + `domain` — S-102 그룹 내 닉네임 입력 화면(GroupNickName). MVI + `CheckNameValidUseCase`(공백 시작/끝·연속 공백·한/영/숫/공백 문자 규칙, `Char.isKorean` 신규)·길이 15(Screen 상수). YGTopBarDetail·YGTextFormField·YGButton 재사용, 진입 자동 포커스. 유효성 위키 [[S-102-닉네임-정책-v0.1]] 일치. **develop 머지(#154)** 사후 기록. 미구현: 다음 네비게이션 |
| [2026-07-20-designsystem-ygscreen-scaffold.md](archive/2026-07-20-designsystem-ygscreen-scaffold.md) | `core/designsystem/screen` — 화면 루트 컨테이너 3종. YGScreen(Surface 래퍼 + YGScreenScope 리시버, color Transparent 고정)·YGScaffold(Material3 Scaffold 래퍼, content=PaddingValues, `contentWindowInsets` 노출)·YGScreenScope(OnBack @Composable, BackHandler emit). **뒤로가기 리팩터**: 초안 `OnBackResult` 반환 강제 → `OnBack` @Composable화·content `-> Unit`·OnBackResult 삭제. **적용**: feature :impl EntryBuilder Scaffold 19곳 → YGScaffold 마이그레이션. **develop 머지(#162)**, 코드=설계 일치. 잔존: YGScreen↔YGScaffold 미통합·화면 컨테이너 ADR 미작성([open-questions](../synthesis/open-questions.md) [2026-07-20]) |
| [2026-07-20-s004-terms-privacy-webview.md](archive/2026-07-20-s004-terms-privacy-webview.md) | S-004 약관/개인정보 화면 분리 + Notion WebView(YGTopBarDetail + WebView, url ViewModel State placeholder, NotionWebView 로컬 컴포넌트: clipToBounds·onRelease·update tag 가드·LocalInspectionMode 프리뷰). **develop 머지(#161)** — 설계는 setting/impl 전제였으나 최종 위치는 `:feature:common:terms:impl`(모듈 분리 스펙과 동일 PR). 화면/MVI/WebView 설계=코드 일치 |
| [2026-07-21-feature-common-terms-module.md](archive/2026-07-21-feature-common-terms-module.md) | `:feature:common:terms:{api,impl}` 신규 — S-004 약관/개인정보 화면(NavKey 2 + Route/Screen/VM 2세트 + NotionWebView + EntryBuilder)을 setting에서 이동. A-003 재사용 위한 feature/common 공유 레이어([ADR-0015](../adr/0015-feature-common-shared-layer.md)). setting은 common:terms:api NavKey만 참조(goTo 유지). **develop 머지(#161)** — settings.gradle include·app 의존·setting:api NavKey 제거 코드 확인, 설계 일치 |
| [2026-07-21-app-preview-component-gallery.md](archive/2026-07-21-app-preview-component-gallery.md) | `:app-preview` — core:designsystem YG* 컴포넌트 갤러리 앱. 메인=카테고리 그룹(Button/Input/Text/Container/Bar) 버튼 목록 → 탭 시 컴포넌트별 showcase 화면(변형·상태 실렌더, 상태 보유 컴포넌트는 remember 인터랙션). 카탈로그 데이터모델 + 컴포넌트별 NavKey 17개/EntryBuilder/@IntoSet DI + PreviewSection 공용 헬퍼. 기존 Navigation3+Hilt multibinding 확장. **develop 머지(#163)** |
| [2026-07-19-ygdangerzone-dashed.md](archive/2026-07-19-ygdangerzone-dashed.md) | `component/ygdangerzone`·`border`·`component/etc` — YGDangerZone 점선 재설계(채움 박스→점선 테두리, solid 구분선→점선) + 신규 프리미티브 `dashedBorder()` Modifier·`YGHorizontalDashedDivider`. modifier 체이닝(`dashedBorder().padding()`) 규칙. **develop 머지(#159)**, 구 solid [ygdangerzone](archive/2026-07-18-ygdangerzone.md) supersede. 잔존: 피그마 좌우 gap-5·고정폭 미반영(open-questions) |
| [2026-07-19-designsystem-radius-none-sync.md](archive/2026-07-19-designsystem-radius-none-sync.md) | `theme/shapes`·`textfield`·`card`·`ygbutton` — radius `none`(0/RectangleShape) 토큰 신설 + YGTextField(commonShape→none·배경 grayScale.white)·YGInviteCard(테두리·clip 모두 none)·YGButtonType SmallSquare(→none) 각진 corner sync. **develop 머지(#159)** |
| [2026-07-19-app-setting-s001.md](archive/2026-07-19-app-setting-s001.md) | `:feature:app:setting` — S-001 앱 설정 화면(ProfileCard + List 4항목: 계정정보/서비스약관/개인정보/버전정보). YGListItem·YGTopBarBack 재사용, ProfileCard 분리, strings.xml, MVI ViewModel(placeholder), 계정정보(S-002)·약관/개인정보(S-004) NavKey+Route stub+entry. **develop 머지(#160)**. ProfileCard 각짐만 `radius.none` 토큰 미머지로 `RectangleShape` 대체(드리프트 반영) |
| [2026-07-18-designsystem-preview-migration.md](archive/2026-07-18-designsystem-preview-migration.md) | `component/*` 프리뷰 — 프리뷰 관용구 `@Preview`+`YGCustomTheme` → `@YGPreview`+`PreviewBox` 통일(런타임 무변경, 프리뷰 애노테이션·래퍼만). **develop 머지(#158)**. 함께 YGAtomicColors internal→public |
| [2026-07-14-yginvitecard.md](archive/2026-07-14-yginvitecard.md) | `component/card` — YGInviteCard(그룹 초대 코드 + 복사 버튼, Active/Invalid 상태별 색·버튼 활성 분기, subText 문자열 주입, onCopyClick 콜백, YGButton SmallSquare 재사용) + YGInviteCardStatus enum. **develop 머지(#148/#136)** |
| [2026-07-15-ygmodalpopup.md](archive/2026-07-15-ygmodalpopup.md) | `component/modal` — YGModalPopup(아이콘+제목+본문+2버튼 중앙 모달, Compose Dialog 래핑, Secondary(좌)·Primary(우) 버튼 타입 기준 파라미터(confirm/cancel 의미 미규정)·단일 isEnabledButton, iconRes @DrawableRes+iconTint, onDismissRequest+DialogProperties 노출, YGButton Medium 재사용). **develop 머지(#151/#135)** |
| [2026-07-18-ygcolorchip.md](archive/2026-07-18-ygcolorchip.md) | `component/ygcolorchip` — YGColorChip(원형 네임태그 컬러칩, YGColorChipType 14종 fill/stroke/text 색, YGColorChipStyle 2크기). ⚠️패키지↔폴더 불일치·타입 12/14 정책 드리프트. **develop 머지(#150)** |
| [2026-07-18-ygtext-date-label.md](archive/2026-07-18-ygtext-date-label.md) | `component/ygtext` — YGDate(날짜 라벨, 패딩 하드코딩)·YGLabel(보조 라벨) 텍스트 프리셋. **develop 머지(#150)** |
| [2026-07-18-ygtopbar.md](archive/2026-07-18-ygtopbar.md) | `component/ygtopbar` — YGTopBar 4변형(Back/Detail/Empty/Default) + private YGTopBarContent, YGIconButton·YGChipButton 재사용, 로고 placeholder(ic_plus). **develop 머지(#152/#127)** |
| [2026-07-18-ygdatebutton.md](archive/2026-07-18-ygdatebutton.md) | `component/ygdatebutton` — YGDateButton(캘린더 날짜 셀, selected/today/disabled/기본 4상태). ⚠️clickableYG 미사용(규약 이탈). **develop 머지(#147/#146)** |
| [2026-07-18-ygdangerzone.md](archive/2026-07-18-ygdangerzone.md) | `component/ygdangerzone` — YGDangerZone(상/하 2슬롯 + 구분선 반투명 컨테이너, IntrinsicSize.Max, YGHorizontalDivider·YGActionItem 조합). **develop 머지(#148/#136)**. 🔁 **superseded** — 점선 재설계 [ygdangerzone-dashed](archive/2026-07-19-ygdangerzone-dashed.md)(#159)가 대체 |
| [2026-07-10-ygtextfield.md](archive/2026-07-10-ygtextfield.md) | `component/textfield` — YGTextField(단일 폼, idle/focused/error/disabled 런타임 상태) |
| [2026-07-10-ygtextformfield.md](archive/2026-07-10-ygtextformfield.md) | `component/textfield` — YGTextFormField(YGTextFieldImpl 재사용 + 하단 errorDescription) |
| [2026-07-12-yghorizontaldivider.md](archive/2026-07-12-yghorizontaldivider.md) | `component/etc` — YGHorizontalDivider(1dp 수평 구분선, Spacer 기반, 두께·색 오버라이드) |
| [2026-07-12-yglistitem.md](archive/2026-07-12-yglistitem.md) | `component/etc` — YGListItem(메인 텍스트 + sub 텍스트 **또는** trailing 아이콘 버튼, 오버로드 2개로 상호배타 + 공통 YGListItemImpl 슬롯. #136 브랜치 refactor로 재설계) |
| [2026-07-12-ygiconbutton.md](archive/2026-07-12-ygiconbutton.md) | `component/ygiconbutton` — YGIconButton(재사용 아이콘 버튼, 크기 프리셋 SIZE_44/48, enabled/pressed tint) + YGIconButtonSize enum. 인라인 아이콘 버튼 공통화 |
| [2026-07-12-ygactionitem.md](archive/2026-07-12-ygactionitem.md) | `component/ygactionitem` — YGActionItem(텍스트 액션 항목, pressed 색, Role.Button) |
| [2026-07-12-ygtextfield-clear-iconbutton.md](archive/2026-07-12-ygtextfield-clear-iconbutton.md) | `component/textfield` — YGTextField clear 버튼 인라인 Box+Image → YGIconButton 교체(clearIconTint 제거). FormField 무편집 반사 반영 |
| [2026-07-12-yglistitem-trailingicon-iconbutton.md](archive/2026-07-12-yglistitem-trailingicon-iconbutton.md) | `component/etc` — YGListItem trailing 아이콘 인라인 Box+Image → YGIconButton 교체(trailingIconColor 제거). clear 교체에 이은 두 번째 통일 |
| [2026-07-13-yginputnumber.md](archive/2026-07-13-yginputnumber.md) | `component/yginputnumber` — YGInputNumber(50×50 숫자 선택 셀, isSelected 반전, Role.Button). 사후 기록(develop #129/이슈 #125, 타 작업자) |
| [2026-07-12-clickableyg-throttle.md](archive/2026-07-12-clickableyg-throttle.md) | `core:util:android` `clickable/` — clickableYG(@Composable, 표준 clickable 위 leading-throttle 게이트, windowMillis 기본 300ms, 기본 리플 ygDimRipple). **develop 머지(#143)** |
| [2026-07-13-ygripple.md](archive/2026-07-13-ygripple.md) | `core:util:android` `clickable/` — ygDimRipple(커스텀 dim ripple IndicationNodeFactory, createRippleModifierNode 위임, alpha 0.15, 기본 리터럴색 YGDimRippleColor). **develop 머지(#143)** |
| [2026-07-13-clickableyg-ripple-variants.md](archive/2026-07-13-clickableyg-ripple-variants.md) | `core:util:android` `clickable/` — clickableYG 리플 변형(Dim/Scale/Merge, @Composable, 합성 indication) + ygScaleRipple(누르면 축소). YGDimRipple/YGScaleRipple 파일 분리. **develop 머지(#143)** |
| [2026-07-16-ygchipbutton.md](archive/2026-07-16-ygchipbutton.md) | `component/ygchipbutton` — YGChipButton(pill 칩 버튼, text + 선택 start/end 아이콘, YGChipButtonColors 주입 + Defaults 프리셋 2종, pressed 색 분기, 아이콘 유무 비대칭 패딩). **develop 머지(#141)** |
| [2026-07-16-ygtogglebutton.md](archive/2026-07-16-ygtogglebutton.md) | `component/ygtogglebutton` — YGToggleButton(pill 선택형 버튼, isSelected 반전 배경/전경/타이포, selectable Role.Button, Colors 미분리·색 인라인 하드결선). **develop 머지(#142)** |

## 작성 가이드
- 형식 권위 출처: [`template.md`](template.md)
- 새 스펙 = 위 인덱스 테이블에 한 줄 등록(스펙 파일과 README는 같은 커밋)
- 스펙이 새 아키텍처 결정을 유발하면 대응 ADR을 함께 만든다([`../adr/`](../adr/README.md))

### Frontmatter (필수)
모든 스펙은 YAML frontmatter로 메타데이터를 단다(상태·날짜·대상·관련의 단일 출처). 필드:
`id`(=파일명 topic, 날짜 접두사 제외) · `title` · `status`(**draft / in-progress / implemented / superseded**) · `category`(ui-spec / behavior-spec …) · `platforms`(=android) · `verified`(코드 대조일) · `related_code`(파일명#심볼, **라인번호·hex·변동수치 금지**) · `related_adr` · `related_spec` · `related_architecture` · `supersedes` · `superseded_by` · `tags`.
- 구현 완료 → `status: implemented` + `archive/` 이동. 대체 → 구 문서 `superseded` + `superseded_by`, 신 문서 `supersedes`.
