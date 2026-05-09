const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Detect portable mode: check if portable.flag exists next to the exe.
// If yes → store data beside the exe (USB portable, data travels with drive).
// If no → store data in AppData (normal installed version).
const exeDir = path.dirname(app.getPath('exe'));
const portableFlag = path.join(exeDir, 'portable.flag');
const isPortable = fs.existsSync(portableFlag);

if (isPortable) {
  const portableDataPath = path.join(exeDir, 'ERP-Data');
  app.setPath('userData', portableDataPath);
} else {
  app.setPath('userData', path.join(app.getPath('appData'), 'ERP Application'));
}

// Disable hardware acceleration to prevent GPU compositor stalls.
// Previously VizDisplayCompositor was disabled which caused the inverse problem.
// Disabling HW acceleration uses CPU-based software rendering which is reliable.
app.disableHardwareAcceleration();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'Shop ERP',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      partition: 'persist:shoperp',
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handler: renderer asks main process to force-repaint the window.
// webContents.invalidate() tells Chromium's compositor to schedule a full
// repaint on the next frame — the reliable fix for post-delete visual stalls.
ipcMain.on('force-repaint', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.invalidate();
  }
});

// IPC handler: get all available OS printers
ipcMain.handle('get-printers', async (event) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return await mainWindow.webContents.getPrintersAsync();
  }
  return [];
});

// IPC handler: silent 80mm thermal receipt printing
ipcMain.on('print-receipt', (event, { htmlContent, printerName }) => {
  let printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const thermalCss = `
    body { font-family: monospace; color: #000; margin: 0; padding: 10px; font-size: 12px; width: 80mm; }
    .receipt-container { width: 100%; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold, .font-semibold { font-weight: bold; }
    .text-xl { font-size: 18px; }
    .text-base { font-size: 14px; }
    .text-sm { font-size: 12px; }
    .text-xs { font-size: 10px; }
    .border-b { border-bottom: 1px dashed #000; }
    .pb-4 { padding-bottom: 16px; }
    .pb-2 { padding-bottom: 8px; }
    .pt-2 { padding-top: 8px; }
    .my-2 { margin: 8px 0; }
    .mt-4 { margin-top: 16px; }
    .mb-4 { margin-bottom: 16px; }
    .space-y-2 > * + * { margin-top: 8px; }
    .space-y-4 > * + * { margin-top: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 10px; }
    th, td { text-align: left; padding: 4px 0; }
    th.text-center, td.text-center { text-align: center; }
    th.text-right, td.text-right { text-align: right; }
    .flex { display: flex; }
    .justify-between { justify-content: space-between; }
    .items-center { align-items: center; }
    .gap-3 { gap: 12px; }
    .uppercase { text-transform: uppercase; }
  `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>${thermalCss}</style>
      </head>
      <body>
        <div class="receipt-container">
          ${htmlContent}
        </div>
      </body>
    </html>
  `;

  printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  printWindow.webContents.on('did-finish-load', () => {
    printWindow.webContents.print({ 
      silent: true, 
      printBackground: true,
      deviceName: printerName || undefined
    }, (success, errorType) => {
      event.sender.send('print-receipt-result', { success, errorType });
      printWindow.close();
    });
  });
});

// IPC handler: silent 50mm QR label sticker printing
ipcMain.on('print-qr-label', (event, { htmlContent, printerName }) => {
  let printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const labelCss = `
    body { font-family: sans-serif; color: #000; margin: 0; padding: 2mm; font-size: 12px; width: 46mm; text-align: center; }
    .label-container { width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .qr-wrapper { margin-bottom: 2px; }
    .product-name { font-weight: bold; font-size: 12px; line-height: 1.2; margin: 2px 0; }
    .product-price { font-size: 14px; font-weight: bold; margin: 2px 0; }
    .product-sku { font-family: monospace; font-size: 10px; margin: 2px 0; }
    .shop-name { font-size: 8px; margin-top: 4px; color: #333; border-top: 1px solid #ccc; padding-top: 2px; width: 100%; }
  `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>${labelCss}</style>
      </head>
      <body>
        <div class="label-container">
          ${htmlContent}
        </div>
      </body>
    </html>
  `;

  printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  printWindow.webContents.on('did-finish-load', () => {
    printWindow.webContents.print({ 
      silent: true, 
      printBackground: true,
      deviceName: printerName || undefined
    }, (success, errorType) => {
      event.sender.send('print-qr-result', { success, errorType });
      printWindow.close();
    });
  });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
