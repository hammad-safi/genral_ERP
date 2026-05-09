# ERP Application - Electron + Vite + React

A desktop ERP application built with Electron, Vite, and React for offline use.

## Features

- **Offline First**: Works without internet connection
- **Fast Development**: Vite provides instant HMR
- **Single EXE**: Packages everything into one installer
- **Modern UI**: Built with React

## Getting Started

### Install Dependencies

```bash
npm install
```

### Development

Run the app in development mode with hot reload:

```bash
npm run electron:dev
```

### Build for Production

#### Option 1: Portable ZIP Distribution (Recommended)
Create a portable ZIP file that doesn't require installation:

```bash
npm run build-portable
```

This will generate `release/Shop-ERP-Portable.zip` which contains:
- The complete Electron application
- All dependencies and assets
- `START_APP.bat` launcher script

**To use the portable version:**
1. Extract `Shop-ERP-Portable.zip` to any folder
2. Double-click `START_APP.bat` or run `Shop ERP.exe` directly
3. The application will start immediately

#### Option 2: Build Only (Unpacked)
If you just want to build the application files without packaging:

```bash
npm run build
```

This creates an unpacked application in `release/win-unpacked/` that you can run directly with `Shop ERP.exe`.

### Distribution Options

Both distribution methods are available:
- **Portable ZIP**: `release/Shop-ERP-Portable.zip` - Easy to distribute, no installation required
- **Unpacked App**: `release/win-unpacked/Shop ERP.exe` - Direct executable

### Troubleshooting

#### Build Issues
- **Symlink Errors**: On Windows, if you see symlink-related errors during the NSIS installer build, use the portable ZIP option instead (recommended)
- **Cache Issues**: Clear build cache with `npm run clear-cache-and-rebuild`

#### Application Issues
- **Database Problems**: The app uses Dexie.js (IndexedDB). If you need to reset the database, clear your browser cache/storage
- **Port Conflicts**: The dev server uses port 5173 by default. Change it in `vite.config.js` if needed

```bash
npm run electron:build
```

The installer will be created in the `release/` directory.

### Run Production Build

To run the app in production mode (without dev server):

```bash
npm run build
npm run electron:start
```

## Project Structure

```
electron-erp-app/
├── src/
│   ├── main.jsx      # React entry point
│   ├── App.jsx       # Main React component
│   ├── App.css       # App styles
│   └── index.css     # Global styles
├── public/
│   └── vite.svg      # App icon
├── main.js           # Electron main process
├── index.html        # HTML entry point
├── vite.config.js    # Vite configuration
└── package.json      # Project dependencies
```

## Configuration

### Vite Configuration (vite.config.js)

- `base: './'` - Uses relative paths for offline compatibility
- `build.outDir: 'dist'` - Output directory for built files

### Electron Builder Configuration (package.json)

- `appId: 'com.electron.erp'` - Unique app identifier
- `win.target: 'nsis'` - Creates Windows installer
- `nsis.oneClick: false` - Allows custom installation directory

## Why Vite + Electron?

1. **No Server Issues**: Vite builds plain HTML/JS files
2. **Faster Builds**: Much lighter than Next.js
3. **Better Offline Support**: Easy to connect local databases
4. **Hot Module Replacement**: Fast development experience