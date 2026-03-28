# Steam Workshop Mod Uploader

A standalone Electron application for uploading mods to the Steam Workshop for "Ascend from Nine Mountains".

## Features

- **Workshop Management**: View, upload, update, and delete your Steam Workshop items
- **Automatic Image Compression**: Preview images over 1MB are automatically compressed to fit Steam's limit
- **Preview Image Support**: Select and preview images before uploading
- **Visibility Settings**: Public, Friends Only, Private, Unlisted
- **Tag Support**: Add tags for better discoverability
- **Statistics**: View subscription, favorite, and view counts for your mods
- **Steam Integration**: Seamless connection with Steam client
- **Auto-extraction**: Automatically extracts mod metadata from ZIP files

## Prerequisites

- [Bun](https://bun.sh/) (v1.0 or higher) - or Node.js v18+
- Steam client must be running
- You must own "Ascend from Nine Mountains" on Steam

## Installation

1. Navigate to the ModUploader directory:
```bash
cd ModUploader-AFNM
```

2. Install dependencies:
```bash
bun install
```

## Development

To run the application in development mode with hot reload:

```bash
bun run dev
```

## Building

### For Windows (Portable):
```bash
bun run build:portable
```

### For Windows (Installer):
```bash
bun run build:win
```

### For Linux:
```bash
bun run build:linux
```

The built application will be in the `release` folder.

## Usage

1. **Launch the application** - Make sure Steam is running first
2. **View Workshop Items** - The app shows your published workshop items with statistics
3. **Upload a New Mod**:
   - Click "+ Upload New Mod"
   - Select the mod's ZIP file (metadata will be auto-extracted)
   - Fill in or edit the title and description
   - Optionally add a preview image
   - Add tags (comma-separated)
   - Choose visibility settings
   - Click "Upload to Workshop"
4. **Update Existing Mods**:
   - Click on any existing workshop item
   - Modify the details or upload a new ZIP
   - Add change notes when updating with new content
   - Click "Update Workshop Item"
5. **Delete Mods**: Click the delete button on any workshop item (with confirmation)
6. **Refresh**: Click the refresh button to reload your workshop items

## CLI Uploads

The uploader also supports a headless update path for repeatable local workshop publishes:

```bash
bun run cli:prepare
bun run cli:upload -- --workshop-id <published-file-id> --zip /absolute/path/to/mod.zip --change-note "What changed"
```

Notes:
- Steam still must be running and logged into the account that owns the workshop item.
- `--workshop-id` is required for updates. Omit it only when intentionally creating a new item and include `--allow-create`.
- On updates, omitting `--visibility` preserves the item's current Workshop visibility. On new item creation, the default remains `private`.
- `--json` prints machine-readable output for wrapper scripts.

## Mod Structure

For a mod to be recognized, its ZIP file should contain a `mod.js` file with metadata:

```javascript
getMetadata: function() {
  return {
    name: 'mod-name',
    title: 'Mod Title',
    version: '1.0.0',
    description: 'Mod description',
    author: { name: 'Your Name' }
  };
}
```

## Project Structure

```
ModUploader-AFNM/
├── electron/
│   ├── main/
│   │   ├── index.ts        # Main entry point
│   │   ├── config.ts       # Configuration constants
│   │   ├── steam.ts        # Steam SDK integration
│   │   ├── steam-types.ts  # Steam TypeScript types
│   │   ├── ipc-handlers.ts # IPC communication handlers
│   │   ├── mod-parser.ts   # ZIP/mod.js parsing
│   │   └── image-utils.ts  # Image compression utilities
│   └── preload/
│       └── index.ts        # Preload script
├── src/
│   ├── components/
│   │   ├── ConfirmDialog.tsx
│   │   ├── DebugConsole.tsx
│   │   ├── GameTitle.tsx
│   │   ├── ImagePreview.tsx
│   │   ├── ModEditor.tsx
│   │   ├── ModList.tsx
│   │   ├── StatusMessage.tsx
│   │   └── SteamStatus.tsx
│   ├── hooks/
│   │   └── useDebugLog.ts
│   ├── types/
│   │   └── navigation.ts
│   ├── App.tsx
│   ├── renderer.tsx
│   └── types.ts
├── styles.css
└── index.html
```

## Technical Details

- Built with Electron 40, React 19, TypeScript 5.9, and Vite 7
- Uses [`@pipelab/steamworks.js`](https://github.com/CynToolkit/steamworks.js) for Steam Workshop integration (actively maintained community fork)
- Styled to match the game's visual theme
- Supports Windows and Linux platforms
- Uses Bun as the package manager and runtime

## Troubleshooting

- **Steam not detected**: Make sure Steam is running before launching the app. The app will show connection status in the header.
- **Upload fails**: Check that your ZIP file is valid and contains a proper mod.js file
- **"Limit exceeded" error**: This usually means the preview image is too large. The app now automatically compresses images over 1MB, but if you still see this error, try using a smaller image.
- **Permission errors**: Run the app with appropriate permissions for file system access
- **Steam connection issues**: Use the "Retry" button in the Steam status indicator
