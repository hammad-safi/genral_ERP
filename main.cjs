const { app, BrowserWindow, shell, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { machineIdSync } = require('node-machine-id');
const crypto = require('crypto');

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAw3gfPMCiBNEK6FgvRH/b
LXUjmzjLwcAYpCOdBnr7pvYHtliCUbcrXuNYbsq4F8D/oN9iuHfDLFsN5TAIvSEc
4uBKZ/vST3zkK1jOIN0ar5MPkCndB3woo6bbmNsFEsEgn0Y/AFgC0t2i+LKK89iI
5oGqMD1AqbwOUJ5kIGPWfRSrz0bSQHDf6rWa0NczTwVoASnpYg2vW9+0bBtA5Xjg
Xl5Tp5wu5YlNrTV/xGqZhr8uge4dhVX+xSHf0oGJSLxzG8es/+SKKPY9dfm2WmvP
4yc741cRCnPWNtEt/wEZ0L+YcQEYaaDx5TwWFIs1ARZjiZ7hXDjS5GJk4Fvg/Mgq
FwIDAQAB
-----END PUBLIC KEY-----`;

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

// Hardware acceleration is ENABLED for smooth GPU rendering.
// CPU-based software rendering was causing performance issues.

let mainWindow;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  const winWidth = Math.floor(width * 0.75);
  const winHeight = Math.floor(height * 0.75);

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
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

ipcMain.on('update-window-title', (event, title) => {
  if (mainWindow && !mainWindow.isDestroyed() && title) {
    mainWindow.setTitle(title);
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

  printWindow.loadURL('about:blank');

  printWindow.webContents.on('did-finish-load', async () => {
    try {
      await printWindow.webContents.executeJavaScript(`
        document.open();
        document.write(decodeURIComponent("${encodeURIComponent(html)}"));
        document.close();
      `);
      
      // Small delay to ensure base64 images are painted before printing
      setTimeout(() => {
        printWindow.webContents.print({ 
          silent: true, 
          printBackground: true,
          deviceName: printerName || undefined
        }, (success, errorType) => {
          event.sender.send('print-receipt-result', { success, errorType });
          printWindow.close();
        });
      }, 250);
    } catch (err) {
      event.sender.send('print-receipt-result', { success: false, errorType: 'Injection failed' });
      printWindow.close();
    }
  });
});

// IPC handler: silent QR label sticker printing
ipcMain.on('print-qr-label', (event, { htmlContent, printerName, quantity = 1 }) => {
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

  printWindow.loadURL('about:blank');

  printWindow.webContents.on('did-finish-load', async () => {
    try {
      await printWindow.webContents.executeJavaScript(`
        document.open();
        document.write(decodeURIComponent("${encodeURIComponent(html)}"));
        document.close();
      `);
      
      setTimeout(() => {
        printWindow.webContents.print({ 
          silent: true, 
          printBackground: true,
          deviceName: printerName || undefined,
          copies: quantity
        }, (success, errorType) => {
          event.sender.send('print-qr-result', { success, errorType });
          printWindow.close();
        });
      }, 250);
    } catch (err) {
      event.sender.send('print-qr-result', { success: false, errorType: 'Injection failed' });
      printWindow.close();
    }
  });
});

// IPC handler: print current window (for A4 reports)
ipcMain.on('print-current-page', (event, { printerName }) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const printOptions = {
      printBackground: true,
      silent: !!printerName,
      deviceName: printerName || undefined
    };
    
    mainWindow.webContents.print(printOptions, (success, errorType) => {
      event.sender.send('print-current-page-result', { success, errorType });
    });
  } else {
    event.sender.send('print-current-page-result', { success: false, errorType: 'No window available' });
  }
});

// Licensing IPC handlers
ipcMain.handle('get-system-id', () => {
  try {
    return machineIdSync();
  } catch (e) {
    return 'UNKNOWN-SYSTEM-ID';
  }
});

function verifyLicenseKey(systemId, signatureBase64) {
  try {
    const verify = crypto.createVerify('SHA256');
    verify.update(systemId);
    verify.end();
    return verify.verify(PUBLIC_KEY, signatureBase64, 'base64');
  } catch (e) {
    return false;
  }
}

ipcMain.handle('check-license', () => {
  const licensePath = path.join(app.getPath('userData'), 'license.key');
  let isLicensed = false;
  
  if (fs.existsSync(licensePath)) {
    const signatureBase64 = fs.readFileSync(licensePath, 'utf8').trim();
    try {
      const systemId = machineIdSync();
      isLicensed = verifyLicenseKey(systemId, signatureBase64);
    } catch(e) {}
  }

  // Trial Logic
  const trialPath = path.join(app.getPath('userData'), 'trial.dat');
  let firstRunTime;
  
  if (!fs.existsSync(trialPath)) {
    firstRunTime = Date.now();
    fs.writeFileSync(trialPath, firstRunTime.toString());
  } else {
    firstRunTime = parseInt(fs.readFileSync(trialPath, 'utf8'), 10);
  }

  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let isTrialValid = false;
  let trialDaysLeft = 0;

  if (now >= firstRunTime && (now - firstRunTime) <= TWO_DAYS_MS) {
    isTrialValid = true;
    trialDaysLeft = Math.ceil((TWO_DAYS_MS - (now - firstRunTime)) / (1000 * 60 * 60 * 24));
  }

  return {
    isLicensed,
    isTrialValid,
    trialDaysLeft
  };
});

ipcMain.handle('activate-license', (event, signatureBase64) => {
  let systemId = '';
  try {
    systemId = machineIdSync();
  } catch(e) {
    return { success: false, message: 'Could not generate system ID' };
  }
  
  const isValid = verifyLicenseKey(systemId, signatureBase64);
  if (isValid) {
    const licensePath = path.join(app.getPath('userData'), 'license.key');
    fs.writeFileSync(licensePath, signatureBase64.trim());
    return { success: true };
  } else {
    return { success: false, message: 'Invalid activation key' };
  }
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
