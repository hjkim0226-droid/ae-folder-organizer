# AE Folder Organizer

After Effects 프로젝트 패널에서 아이템을 자동으로 폴더별로 정리하는 CEP 확장 프로그램입니다.

![After Effects](https://img.shields.io/badge/After%20Effects-2023+-9999FF?logo=adobeaftereffects)
![License](https://img.shields.io/badge/License-MIT-green)
![Version](https://img.shields.io/badge/Version-1.13.0-blue)

## 주요 기능

### 📁 스마트 폴더 정리
- **렌더 컴포지션 자동 감지**: `_render`, `_final`, `_output` 등 키워드 기반
- **카테고리별 분류**: Comps, Footage, Images, Audio, Solids
- **시퀀스 감지**: EXR, PNG 등 이미지 시퀀스 자동 분류
- **서브카테고리 시스템**: 필터 기반 세분화 정리

### 🏷️ 통합 필터 시스템
| 필터 | 문법 | 예시 | 태그 색상 |
|------|------|------|-----------|
| 확장자 | `.확장자` | `.mp4`, `.mov` | 보라색 |
| 접두사 | `prefix:접두사` | `prefix:VFX_` | 노란색 |
| 키워드 | `키워드` | `fire`, `explosion` | 청록색 |

### 🔤 Batch Rename
- 선택한 아이템 일괄 이름 변경
- Prefix/Suffix 추가
- Find & Replace
- 실시간 미리보기
- Undo 지원 (Ctrl+Z)

### 🎨 라벨 컬러 시스템
- 폴더/카테고리/서브카테고리별 라벨 컬러 자동 적용
- AE 라벨 컬러 1-16 지원

### ⚙️ 커스터마이징
- 폴더 구조 완전 커스터마이징
- 드래그 앤 드롭으로 순서 변경
- 예외 규칙 시스템
- 설정 Export/Import

## 📦 설치

### ZXP 설치 (권장)
1. [Releases](../../releases)에서 최신 `.zxp` 파일 다운로드
2. [aescripts ZXP Installer](https://aescripts.com/learn/zxp-installer/)로 설치

### 개발 모드
```bash
git clone https://github.com/hjkim0226-droid/ae-folder-organizer.git
cd ae-folder-organizer

npm install
npm run build

# 개발 (HMR)
npm run dev

# ZXP 빌드
npm run zxp
```

> ⚠️ 개발 모드에서는 [PlayerDebugMode 활성화](https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_12.x/Documentation/CEP%2012%20HTML%20Extension%20Cookbook.md#debugging-unsigned-extensions) 필요

## 🚀 사용법

1. After Effects 실행
2. `Window > Extensions > AE Folder Organizer` 열기
3. 폴더 구조 설정 (선택사항)
4. **🗂️ ORGANIZE ALL** 버튼 클릭

## 📁 정리 결과 예시

```
프로젝트 패널
├── 📁 00_Render
│   ├── MainComp_render_v01
│   └── Scene01_final
├── 📁 01_Source
│   ├── 01_Comps/
│   ├── 02_Footage/
│   │   ├── Sequences/
│   │   │   └── EXR Sequence/
│   │   └── _MP4/
│   ├── 03_Images/
│   └── 04_Audio/
└── 📁 99_System
    └── 01_Solids/
```

## 📚 문서

- [전체 기능 가이드](docs/FEATURES.md) - 모든 기능 상세 설명
- [개발자 가이드](docs/DEVELOPMENT.md) - 개발 환경 설정 및 아키텍처
- [변경 로그](CHANGELOG.md) - 버전별 변경 사항

## 🛠 기술 스택

| 구성요소 | 기술 |
|----------|------|
| CEP 프레임워크 | [Bolt CEP](https://github.com/hyperbrew/bolt-cep) |
| UI | React 19 + TypeScript |
| 빌드 | Vite |
| AE 스크립팅 | ExtendScript (ES3 호환) |

## 프로젝트 구조

```
ae-folder-organizer/
├── src/
│   ├── domain/          # 비즈니스 로직 (순수 TypeScript)
│   │   ├── types/       # 타입 정의
│   │   ├── models/      # Category, Filter, Config 모델
│   │   └── constants/   # 기본값, 확장자 목록
│   ├── ui/              # React UI 컴포넌트
│   │   ├── components/  # FolderItem, DraggableCategory 등
│   │   ├── contexts/    # ConfigContext, HostAppContext
│   │   └── hooks/       # useOrganize, useBatchRename
│   ├── jsx/             # ExtendScript (AE 조작)
│   │   ├── aeft/        # After Effects 전용
│   │   └── shared/      # 공유 로직
│   └── js/              # CEP 인프라
│       └── lib/         # CSInterface, 유틸리티
├── docs/                # 문서
├── dist/                # 빌드 출력
└── package.json
```

## 지원 버전

| 앱 | 버전 | 상태 |
|----|------|------|
| After Effects | 2023+ | ✅ 완전 지원 |
| Premiere Pro | 2023+ | ⚠️ 실험적 |

## 📄 License

MIT

---

Made with ❤️ for After Effects users
