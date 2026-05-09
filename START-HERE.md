# Getting Started with Your Electron ERP App

## Project Overview

This is a desktop ERP application built with:
- **Electron** - For creating the desktop application
- **Vite** - For fast development and building
- **React** - For the user interface

## Installation

The project already has dependencies installed. If you need to reinstall:

```bash
npm install
```

## Development

### Run in Development Mode (with Hot Reload)

```bash
npm run electron:dev
```

This will:
1. Start the Vite dev server on http://localhost:5173
2. Wait for the server to be ready
3. Launch the Electron app with hot reload enabled

### Run in Production Mode

```bash
# First, build the app
npm run build

# Then run the Electron app
npm run electron:start
```

## Building the Installer (.exe)

To create a Windows installer:

```bash
npm run electron:build
```

The installer will be created in the `release/` directory as a `.exe` file that you can distribute to users.

## Project Structure

```
electron-erp-app/
├── src/
│   ├── main.jsx      # React entry point
│   ├── App.jsx       # Main React component
│   ├── App.css       # Component styles
│   └── index.css     # Global styles
├── public/
│   └── vite.svg      # App icon
├── main.js           # Electron main process (window management)
├── index.html        # HTML entry point
├── vite.config.js    # Vite configuration (relative paths for offline)
├── package.json      # Dependencies and scripts
└── README.md         # Full documentation
```

## Key Configuration

### vite.config.js
- `base: './'` - Uses relative paths so the app works offline without a server

### main.js
- Creates a 1200x800 window
- In development: loads from `http://localhost:5173`
- In production: loads from `dist/index.html`

### package.json
- `electron:dev` - Development mode with hot reload
- `electron:build` - Creates Windows installer
- `electron:start` - Runs production build

## Next Steps

1. **Customize the UI**: Edit `src/App.jsx` to add your ERP features
2. **Add Pages**: Create new components for products, inventory, sales, etc.
3. **Add Database**: Connect a local SQLite database for data storage
4. **Style**: Modify `src/App.css` and `src/index.css` for custom styling

## Troubleshooting

### App doesn't start
Make sure you've run `npm install` first.

### Build fails
Try deleting `node_modules` and running `npm install` again.

### Port already in use
If port 5173 is taken, edit `vite.config.js` and change the port number.

### Electron Builder Error: "Cannot create symbolic link : A required privilege is not held by the client"

This is a **Windows permission issue** that occurs when building the installer. Windows requires special privileges to create symbolic links, which electron-builder needs during the build process.

**Solution 1: Enable Developer Mode (Easiest - No Admin Required)**
1. Open **Settings**
2. Go to **Privacy & Security** (or **Update & Security** on Windows 10)
3. Click on **For developers**
4. Toggle **Developer Mode** to **ON**
5. Try building again: `npm run electron:build`

**Solution 2: Run as Administrator**
1. Right-click on your terminal or VS Code
2. Select **Run as Administrator**
3. Run the build command: `npm run electron:build`

**Solution 3: Grant Symbolic Link Privilege (Requires Admin)**
1. Press `Win + R`, type `secpol.msc`, press Enter
2. Navigate to: **Local Policies** → **User Rights Assignment**
3. Find **Create symbolic links**
4. Double-click and add your user account
5. Restart your computer and try building again

For automated help, run the included script:
```bash
./fix-symbolic-links.bat
```
