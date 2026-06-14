# Application Components

## Architecture Overview

The Point-and-Click Adventure Game Builder is a single-page React application with a persistent left-navigation editor selector and a main editor workspace. Each editor is a self-contained module with its own sub-components.

---

## Core Shell Components

### AppShell
- Root application component
- Renders NavigationSidebar + EditorWorkspace
- Manages active editor state

### NavigationSidebar
- Vertical icon + label navigation for all 10 editors
- Highlights active editor

### EditorWorkspace
- Dynamic render area switching between editors
- Provides consistent header with editor title

---

## Editor Modules

### SceneEditor, EventEditor, AssetsManager, UIEditor, SpriteManager
### SettingsEditor, TitleScreenEditor, StageEditor, GoalEditor, CursorEditor

Each editor is a self-contained React component module with sub-components for its panels, toolbars, and property inspectors.

---

## Shared/Common Components

- Modal, Panel, Toolbar, PropertyField, DragHandle
- ConfirmDialog, Toast, TabBar, ColorPicker, FileDropZone
