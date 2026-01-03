# AE Folder Organizer - 개발자 가이드

이 문서는 AE Folder Organizer CEP 확장 프로그램의 개발 환경 설정, 아키텍처, 기여 방법을 설명합니다.

---

## 목차

1. [개발 환경 설정](#개발-환경-설정)
2. [프로젝트 구조](#프로젝트-구조)
3. [아키텍처](#아키텍처)
4. [빌드 및 배포](#빌드-및-배포)
5. [테스트](#테스트)
6. [ExtendScript 가이드](#extendscript-가이드)
7. [기여 가이드](#기여-가이드)

---

## 개발 환경 설정

### 필수 요구사항

- Node.js 18+
- npm 또는 yarn
- After Effects 2023+
- 코드 에디터 (VS Code 권장)

### 설치

```bash
# 저장소 클론
git clone https://github.com/hjkim0226-droid/ae-folder-organizer.git
cd ae-folder-organizer

# 의존성 설치
npm install
```

### PlayerDebugMode 활성화

CEP 확장 프로그램을 개발 모드로 실행하려면 PlayerDebugMode를 활성화해야 합니다.

#### macOS
```bash
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
```

#### Windows
```
레지스트리 편집기에서:
HKEY_CURRENT_USER\Software\Adobe\CSXS.11
PlayerDebugMode = 1 (문자열)
```

### 개발 서버 실행

```bash
# 개발 모드 (HMR 지원)
npm run dev

# 심볼릭 링크 생성 (AE에서 확장 프로그램 인식)
npm run symlink
```

After Effects를 재시작하고 `Window > Extensions > AE Folder Organizer`에서 패널을 열 수 있습니다.

---

## 프로젝트 구조

```
ae-folder-organizer/
├── src/
│   ├── domain/              # 도메인 레이어 (순수 TypeScript)
│   │   ├── types/           # 타입 정의
│   │   │   └── index.ts     # CategoryType, FolderConfig, etc.
│   │   ├── models/          # 도메인 모델
│   │   │   ├── category.ts  # 카테고리 관련 로직
│   │   │   ├── filter.ts    # 필터 시스템
│   │   │   └── config.ts    # 설정 관리
│   │   └── constants/       # 상수
│   │       ├── defaults.ts  # 기본 설정
│   │       └── extensions.ts # 확장자 목록
│   │
│   ├── ui/                  # UI 레이어 (React)
│   │   ├── components/      # React 컴포넌트
│   │   │   ├── FolderItem/
│   │   │   ├── DraggableCategory/
│   │   │   └── SubcategoryItem/
│   │   ├── contexts/        # React Context
│   │   │   ├── ConfigContext.tsx
│   │   │   └── HostAppContext.tsx
│   │   └── hooks/           # Custom Hooks
│   │       ├── useOrganize.ts
│   │       ├── useBatchRename.ts
│   │       └── useStats.ts
│   │
│   ├── jsx/                 # ExtendScript 레이어
│   │   ├── aeft/            # After Effects 전용
│   │   │   ├── aeft.ts      # 메인 ExtendScript 함수
│   │   │   └── aeft-utils.ts
│   │   ├── ppro/            # Premiere Pro 전용
│   │   │   └── ppro.ts
│   │   └── shared/          # 공유 로직
│   │       ├── types.ts
│   │       └── matchLogic.ts
│   │
│   └── js/                  # CEP 인프라
│       ├── main/            # 진입점
│       │   ├── main.tsx     # 메인 App 컴포넌트
│       │   └── index-react.tsx
│       └── lib/             # 유틸리티
│           ├── utils/
│           │   ├── bolt.ts  # Bolt CEP 유틸리티
│           │   └── aeft.ts
│           └── cep/         # CEP 타입 정의
│
├── docs/                    # 문서
├── dist/                    # 빌드 출력
├── cep.config.ts            # CEP 설정
├── vite.config.ts           # Vite 설정
└── package.json
```

---

## 아키텍처

### 레이어 구조

```
┌─────────────────────────────────────────────┐
│               UI Layer (React)              │
│  - 컴포넌트, Context, Hooks                  │
│  - 사용자 인터페이스 렌더링                    │
├─────────────────────────────────────────────┤
│             Domain Layer (Pure TS)          │
│  - 비즈니스 로직                              │
│  - 타입 정의                                  │
│  - 외부 의존성 없음                           │
├─────────────────────────────────────────────┤
│           ExtendScript Layer                │
│  - After Effects API 호출                    │
│  - 프로젝트 아이템 조작                        │
│  - ES3 호환 코드                              │
└─────────────────────────────────────────────┘
```

### 데이터 흐름

```
User Action (UI)
    ↓
React Component
    ↓
Context / Hook
    ↓
evalTS() 호출
    ↓
ExtendScript 실행
    ↓
After Effects API
    ↓
결과 반환
    ↓
UI 업데이트
```

### 주요 함수

#### ExtendScript (aeft.ts)

| 함수 | 설명 |
|------|------|
| `organizeProject(configJson)` | 프로젝트 정리 실행 |
| `getProjectStats()` | 프로젝트 통계 반환 |
| `getSelectedItems()` | 선택된 아이템 목록 |
| `batchRenameItems(requests)` | 일괄 이름 변경 |
| `getLabelColors()` | AE 라벨 컬러 목록 |

#### React Hooks

| 훅 | 설명 |
|----|------|
| `useConfig()` | 설정 상태 관리 |
| `useHostApp()` | 호스트 앱 정보 |
| `useOrganize()` | 정리 작업 실행 |
| `useBatchRename()` | 이름 변경 로직 |
| `useStats()` | 통계 데이터 |

---

## 빌드 및 배포

### 빌드 명령어

```bash
# 개발 빌드
npm run build

# ZXP 패키지 생성 (배포용)
npm run zxp

# ZIP 패키지 생성
npm run zip

# 파일 변경 감지 빌드
npm run watch
```

### 빌드 출력

```
dist/
├── cep/
│   ├── manifest.xml        # CEP 매니페스트
│   ├── index.html          # 패널 HTML
│   ├── main.jsx            # 번들된 React 코드
│   └── jsx/                # 번들된 ExtendScript
└── zxp/
    └── ae-folder-organizer.zxp  # 서명된 패키지
```

### 배포 체크리스트

1. 버전 업데이트 (`package.json`, `main.tsx`)
2. CHANGELOG.md 업데이트
3. `npm run zxp` 실행
4. GitHub Release 생성
5. ZXP 파일 업로드

---

## 테스트

### 단위 테스트

```bash
# 테스트 실행
npm test

# 워치 모드
npm run test:watch
```

### 테스트 파일 위치

```
src/domain/models/__tests__/
├── category.test.ts
├── config.test.ts
└── filter.test.ts
```

### 테스트 예시

```typescript
// filter.test.ts
import { matchSubcategoryFilter } from '../filter';

describe('matchSubcategoryFilter', () => {
  it('should match extension filter', () => {
    const filter = { type: 'ext', value: 'mp4' };
    expect(matchSubcategoryFilter('video.mp4', filter)).toBe(true);
  });
});
```

---

## ExtendScript 가이드

### ES3 제약사항

ExtendScript는 ECMAScript 3 기반이므로 다음 기능을 사용할 수 없습니다:

```javascript
// ❌ 사용 불가
const x = 1;           // const
let y = 2;             // let
[a, b] = [1, 2];       // 구조 분해
arr.forEach()          // 배열 메서드
JSON.stringify()       // JSON 객체 (일부 버전)
() => {}              // 화살표 함수

// ✅ 사용 가능
var x = 1;
for (var i = 0; i < arr.length; i++) {}
function fn() {}
```

### Bolt CEP evalTS

Bolt CEP는 TypeScript로 ExtendScript를 작성하고 `evalTS`로 호출할 수 있게 합니다:

```typescript
// UI 코드 (React)
import { evalTS } from '../lib/utils/bolt';

const result = await evalTS('organizeProject', JSON.stringify(config));
```

```typescript
// ExtendScript (aeft.ts)
export const organizeProject = (configJson: string): OrganizeResult => {
  const config = JSON.parse(configJson);
  // AE API 호출...
  return result;
};
```

### 디버깅

1. Chrome DevTools: `localhost:8088` (개발 모드)
2. ExtendScript Toolkit (ESTK)
3. `$.writeln()` 로깅

---

## 기여 가이드

### 브랜치 전략

```
main         ← 안정 릴리스
  └── develop    ← 개발 브랜치
       └── feature/xxx  ← 기능 개발
       └── fix/xxx      ← 버그 수정
```

### 커밋 메시지 규칙

```
feat: 새 기능 추가
fix: 버그 수정
docs: 문서 변경
style: 포맷팅 (코드 변경 없음)
refactor: 리팩토링
test: 테스트 추가/수정
chore: 빌드 설정 등
```

### PR 체크리스트

- [ ] 코드 스타일 준수
- [ ] 테스트 통과
- [ ] CHANGELOG.md 업데이트
- [ ] 문서 업데이트 (필요시)

### 코드 스타일

- TypeScript strict 모드
- ESLint 규칙 준수
- 함수/변수명 camelCase
- 컴포넌트명 PascalCase
- 상수 UPPER_SNAKE_CASE

---

## 유용한 리소스

- [Bolt CEP 문서](https://github.com/hyperbrew/bolt-cep)
- [CEP Cookbook](https://github.com/Adobe-CEP/CEP-Resources)
- [After Effects Scripting Guide](https://ae-scripting.docsforadobe.dev/)
- [types-for-adobe](https://github.com/AdobeDocs/types-for-adobe)

---

## 문의

이슈나 질문은 [GitHub Issues](../../issues)에 등록해주세요.
