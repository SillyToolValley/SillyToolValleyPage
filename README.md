# Silly Tool Valley

Grenade!를 메인으로 게임, 개발 도구, 전자책을 함께 전시하는 GitHub Pages 스튜디오 홈페이지입니다. 공식 아트를 크게 보여주는 첫 화면, 전체 게임 카탈로그, Tools & Books, 참여 기록, 스튜디오 소개 순서로 구성됩니다. 게임을 열면 전체 화면 상세에서 소개, 스토어, 공식 영상, 참여 기록을 볼 수 있습니다.

## 게임 / 공모전 업데이트

1. `data/games.json`의 게임 정보와 `milestones`를 수정합니다.
2. 공식 이미지를 `images/games/`에 추가합니다.
3. `python tooling/build_site.py`를 실행합니다.
4. 데이터, 이미지, 생성된 `index.html`을 함께 커밋합니다.

`featured`는 첫 화면의 게임 ID입니다. 게임마다 고유한 `id`, `title`, `platform`, `status`, `description`, `links`를 입력하면 카탈로그 카드·작품 수·상세가 함께 생성됩니다. `image`, `heroImage`, `logo`, `gallery`, `videos: [{youtubeId, label}]`은 선택 항목입니다. 이미지가 없는 게임은 제목과 개발 상태를 표시합니다. `archive: true`는 메인 카탈로그에서 제외하고 공모전 기록의 상세로 연결합니다. 미정 출시일이나 확인되지 않은 성과는 넣지 않습니다.

메인 소개는 `home.pitch`, `home.summary`, 대표 표기는 `displayTitle`, `subtitle`에서 관리합니다. 새 게임 추가에 3D 모델링 작업은 필요하지 않습니다.

## 구현

- `templates/home.html`: 페이지 구성. `index.html`은 생성 결과입니다.
- `templates/partials/`: 전 페이지의 공통 헤더와 푸터. 각 페이지의 원본은 `templates/`에 있습니다.
- `css/home.css`, `css/style.css`: 페이지별 레이아웃과 기존 커버플로우 구조.
- `css/site.css`: 공통 색상·타이포그래피·버튼 및 반응형 스타일.
- `css/showcase.css`: 스크롤에 고정된 메인 장면과 카드→상세 이미지 전환.
- `css/reader-theme.css`: 두 전자책 리더의 공통 테마. PDF 내용은 변경하지 않습니다.
- `js/home.js`: 내비게이션, 상세 모달, 접근성 및 모션 설정.
- `js/world.js`: 메인 아트에만 적용하는 WebGL 렌더러. 원본 비율을 유지한 공식 아트와 두 게임 화면을 한 스크롤 타임라인으로 연결합니다. PerspectiveCamera의 미세한 시점 변화와 GLSL 재질 경계 전환을 사용합니다. 정지하거나 화면 밖으로 나가면 렌더 루프를 멈춥니다.
- 이전 입자·디졸브·화면 왜곡 실험은 현재 홈에서 사용하지 않습니다.

모션은 첫 방문부터 기본으로 켜져 있으며 첫 화면의 버튼으로 켜고 끌 수 있습니다. 모션을 끄면 등장 효과와 시차를 정지합니다. 숨겨진 탭이나 상세창 뒤에서도 WebGL 렌더링을 멈춥니다. 상세창은 Tab/Escape와 뒤로 가기를 지원하고, 닫으면 영상 iframe을 제거해 재생을 멈춥니다. JavaScript가 없으면 정적 정보와 상세를 읽을 수 있으며, WebGL 실패 시 공식 이미지로 대체됩니다.

## 로컬 미리보기

```sh
python -m http.server 4173 --bind 127.0.0.1
```

`http://127.0.0.1:4173/`에서 확인합니다. 내부 경로는 GitHub Pages 하위 경로와 호환되는 상대 경로입니다. `index.html`, `assets.html`, `asset.html`, `ebooks.html`은 공통 템플릿으로 함께 빌드합니다.

## 자료와 디자인 참고

- [Panic](https://panic.com/), [inkle](https://www.inklestudios.com/): 게임·툴·책을 독립적인 제품군으로 전시하는 구성.
- [Aggro Crab](https://aggrocrab.com/), [Chibig](https://chibig.com/): 큰 공식 키 아트, 과감한 글자와 색, 여러 게임을 모으는 카탈로그 구성. 사이트의 코드나 에셋을 복사하지 않았습니다.

- Grenade!: [Steam 스토어](https://store.steampowered.com/app/5151370/), [데모](https://store.steampowered.com/app/5327260/), [게임플레이 영상](https://www.youtube.com/watch?v=z3WOYKJOa5E), [공식 티저](https://www.youtube.com/watch?v=fnFhyuxTK6k).
- 티저 0:19와 1:05에서 확인한 수류탄은 매끈한 짙은 몸체, 아래쪽 붉은 띠, 회색 상단 부품을 사용합니다. 영상만으로 숨겨진 면을 확정하지 않았습니다. 임의로 만든 격자형 수류탄과 절차적 마을은 현재 홈페이지에서 사용하지 않습니다. Meshy 생성은 실행하지 않았습니다.
- 슈피겔만의 뮤직 카니발: [공식 사이트](https://musiccarnival.vercel.app/).
- I'm a Pianist Too: [Google Play](https://play.google.com/store/apps/details?id=com.sillytoolvalley.imapianisttoo).
- 출시 상태와 공모전 성과: 스튜디오 제공 정보 (2026-10-09).
- [Igloo](https://www.igloo.inc/): 화면을 크게 쓰는 구성과 재질·입자 전환의 참고.
- [ITom](https://itomdev.com/)과 [제작자의 기술 설명](https://tympanus.net/codrops/2026/06/11/sketching-the-impossible-a-3d-portfolio-built-without-a-single-3d-model/): 이미지 평면을 통한 공간 구성, 색상 리빌, 접근 후 상세 진입의 참고. 레퍼런스의 코드나 에셋은 복제하지 않았습니다.
- Terra Palz의 공식 개발 소식: https://www.instagram.com/terrapalz/
- Terra Palz의 표지는 개발 상태를 위한 타이포그래피이며 실제 게임 화면이 아닙니다. Castaway Cove 실행 파일은 배포에 포함하지 않습니다.
- Three.js 0.180.0은 로컬 `js/vendor/`에서 불러옵니다. MIT 라이선스는 `THREE-LICENSE.txt`에 있습니다.

## 탐색과 가독성

상단 메뉴에서 개발 도구 카탈로그와 전자책 서재로 이동합니다. UTerminal 상세는 개발 도구 카탈로그와 Tools & Books에서 연결합니다. 기존 페이지의 `index.html#about`, `index.html#contact` 링크도 유지합니다. 본문은 17~18px, 모바일 메뉴와 주요 버튼은 15px입니다. 모바일에서는 한 열로 배치하고 메인 아트의 초점을 캐릭터에 맞춥니다.

전자책은 기존 3D 커버플로우를 유지하며 드래그, 방향키, 이전/다음 버튼으로 선택할 수 있습니다. 모션 줄이기 환경에서는 버튼 전환을 즉시 적용합니다. WebGL은 안티앨리어싱과 최소 2배 정수 렌더링 해상도, 밉맵과 이방성 필터를 사용합니다.

대표 게임의 `gallery` 앞 두 장은 메인 장면의 02/03으로 사용됩니다. 스크롤이나 장면 버튼으로 이동합니다. 모션을 끄면 감쇠·재질 전환·시차를 멈추고 장면을 즉시 전환합니다. 카드의 이미지를 누르면 지원 브라우저에서 같은 이미지가 상세 화면으로 확대됩니다. WebGL이 실패하면 정적 아트와 기존 카탈로그를 사용합니다.

2026-10-09 재검토: Igloo의 전체 화면 장면 유지와 스크롤에 따른 시점 변화, ITom의 재질 리빌과 클릭 후 공간 진입을 확인했습니다. 현재 구현은 게임 공식 이미지 기반 2.5D 전환이며 Igloo의 3D 모델/재질 시스템을 재현한 것은 아닙니다. 장식용 원·코트 선·별 도형은 사용하지 않습니다.

UI 글꼴은 로컬 `fonts/PretendardVariable.woff2`로 통일합니다. SIL OFL 1.1 라이선스는 같은 폴더에 포함했습니다. 본문 18/30px, 보조문구 14/20px, 메뉴 16/24px를 기준으로 사용합니다. 제목은 중단점별 고정 크기를 사용하고, 텍스트 컨테이너에는 이동·배율 애니메이션을 적용하지 않습니다. Windows의 글꼴 다듬기 설정은 사이트 CSS와 별개입니다.
