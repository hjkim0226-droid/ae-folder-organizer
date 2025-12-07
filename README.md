# AE Folder Organizer

After Effects 프로젝트 패널에서 아이템을 자동으로 폴더별로 정리하는 CEP 확장 프로그램입니다.

![After Effects](https://img.shields.io/badge/After%20Effects-2023+-9999FF?logo=adobeaftereffects)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ 기능

- **2-폴더 자동 정리**
  - `01_Render` - 렌더용 컴포지션 (키워드 기반)
  - `02_Data` - 나머지 모든 아이템 (서브폴더로 세분화)

- **스마트 분류**
  - 렌더 키워드 자동 인식: `_render`, `_final`, `_output`, `_export` 등
  - 파일 타입별 서브폴더: Footage, Images, Audio
  - 솔리드/널 자동 숨김 (`_System` 폴더)

- **커스터마이징**
  - 폴더 이름 변경 가능
  - 렌더 키워드 편집 가능
  - 서브폴더 정리 on/off

## 📦 설치

### ZXP 설치 (권장)
1. [Releases](../../releases)에서 최신 `.zxp` 파일 다운로드
2. [aescripts ZXP Installer](https://aescripts.com/learn/zxp-installer/)로 설치

### 개발 모드
```bash
# Clone
git clone https://github.com/hjkim0226-droid/ae-folder-organizer.git
cd ae-folder-organizer

# Install
npm install

# Build & symlink
npm run build

# Development (HMR)
npm run dev
```

> ⚠️ 개발 모드에서는 [PlayerDebugMode 활성화](https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_12.x/Documentation/CEP%2012%20HTML%20Extension%20Cookbook.md#debugging-unsigned-extensions) 필요

## 🚀 사용법

1. After Effects 실행
2. `Window > Extensions > AE Folder Organizer` 열기
3. 설정 조정 (선택사항)
4. **ORGANIZE PROJECT** 버튼 클릭

## 📁 정리 결과 예시

```
프로젝트 패널
├── 📁 01_Render
│   ├── MainComp_render_v01
│   └── Scene01_final
└── 📦 02_Data
    ├── _Comps/
    ├── _Footage/
    ├── _Images/
    ├── _Audio/
    └── _System/   ← (솔리드, 널)
```

## 🛠 기술 스택

- [Bolt CEP](https://github.com/hyperbrew/bolt-cep) - CEP 개발 프레임워크
- React + TypeScript
- ExtendScript

## 📄 License

MIT
