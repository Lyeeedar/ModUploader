# Steam Workshop Mod Uploader

A standalone Electron application for uploading mods to the Steam Workshop for "Ascend from Nine Mountains".

## Features

- List local mods from the parent directory
- Upload new mods to Steam Workshop
- Update existing workshop items
- Preview image support
- Visibility settings (Public, Friends Only, Private, Unlisted)
- Tag support for better discoverability
- View your published workshop items with statistics

## Prerequisites

- Node.js (v16 or higher)
- npm
- Steam client must be running
- You must own "Ascend from Nine Mountains" on Steam

## Installation

1. Navigate to the ModUploader directory:
```bash
cd exampleMod/ModUploader
```

2. Install dependencies:
```bash
npm install
```

## Development

To run the application in development mode:

```bash
npm run build
npm start
```

To watch for TypeScript changes:
```bash
npm run dev
```

## Building

### For Windows:
```bash
npm run build:win
```

### For Linux:
```bash
npm run build:linux
```

The built application will be in the `dist` folder.

## Usage

1. **Launch the application** - Make sure Steam is running first
2. **View Local Mods** - The app automatically scans for mods in the parent directories
3. **Upload a Mod**:
   - Click "Upload" next to a local mod or fill in the form manually
   - Select the mod's ZIP file
   - Fill in the title and description
   - Optionally add a preview image
   - Add tags (comma-separated)
   - Choose visibility settings
   - Click "Upload to Workshop"
4. **Update Existing Mods** - Click "Update" next to mods that are already on the Workshop
5. **View Workshop Items** - See your published items with subscription/favorite/view counts

## Mod Structure

For a mod to be recognized, it must have a `mod.json` file in its root directory with at least:

```json
{
  "name": "Mod Name",
  "version": "1.0.0",
  "description": "Mod description",
  "author": "Your Name"
}
```

After uploading, the workshop ID will be saved to the `mod.json` file automatically.

## Technical Details

- Built with Electron and TypeScript
- Uses `steamworks.js` for Steam Workshop integration
- Styled to match the game's visual theme
- Supports Windows and Linux platforms

## Troubleshooting

- **Steam not detected**: Make sure Steam is running before launching the app
- **Upload fails**: Check that your ZIP file is valid and not too large
- **Mods not showing**: Ensure your mods have a valid `mod.json` file
- **Permission errors**: Run the app with appropriate permissions for file system access