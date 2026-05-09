const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe API to the renderer process.
// This is needed because contextIsolation: true is set in webPreferences.
contextBridge.exposeInMainWorld('electronAPI', {
  // Ask the main process to call webContents.invalidate(), which forces
  // Electron's compositor to flush and repaint the entire window.
  // This fixes the "screen frozen after bulk delete, minimize to unfreeze" bug.
  forceRepaint: () => ipcRenderer.send('force-repaint'),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printReceipt: (htmlContent, printerName) => new Promise((resolve) => {
    ipcRenderer.once('print-receipt-result', (event, result) => resolve(result));
    ipcRenderer.send('print-receipt', { htmlContent, printerName });
  }),
  printQrLabel: (htmlContent, printerName) => new Promise((resolve) => {
    ipcRenderer.once('print-qr-result', (event, result) => resolve(result));
    ipcRenderer.send('print-qr-label', { htmlContent, printerName });
  }),
});
