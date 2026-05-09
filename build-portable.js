const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { execSync } = require('child_process');

const projectRoot = __dirname;
const unpackedDir = path.join(projectRoot, 'release', 'win-unpacked');
const outputDir = path.join(projectRoot, 'release');
const zipPath = path.join(outputDir, 'Shop-ERP-Portable.zip');

async function buildPortable() {
  console.log('\n========================================');
  console.log('  Shop ERP — Portable Build');
  console.log('========================================\n');

  // Step 1: Vite build (frontend)
  console.log('Step 1/3: Building frontend...');
  execSync('npm run build', { stdio: 'inherit', cwd: projectRoot });
  console.log('Frontend build complete.\n');

  // Step 2: Electron-builder unpacked (no NSIS installer, no code signing)
  console.log('Step 2/3: Packaging Electron (unpacked, no installer)...');
  execSync('npx electron-builder --win --dir', {
    stdio: 'inherit',
    cwd: projectRoot,
    env: {
      ...process.env,
      CSC_IDENTITY_AUTO_DISCOVERY: 'false',
      CSC_KEY_PASSWORD: '',
    },
  });
  console.log('Electron packaging complete.\n');

  if (!fs.existsSync(unpackedDir)) {
    console.error('ERROR: Unpacked app not found at:', unpackedDir);
    process.exit(1);
  }

  // Step 3: Create portable markers
  console.log('Step 3/3: Creating portable package...');

  // Create portable.flag — main.cjs checks for this to detect portable mode
  fs.writeFileSync(
    path.join(unpackedDir, 'portable.flag'),
    'PORTABLE=true\n'
  );

  // Create ERP-Data folder where the database will live on the USB
  const dataDir = path.join(unpackedDir, 'ERP-Data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(dataDir, 'README.txt'),
    'This folder contains your Shop ERP database.\n' +
    'Keep it in the same folder as Shop ERP.exe.\n' +
    'Do not delete it or your data will be lost.\n'
  );

  // Create START.bat launcher
  fs.writeFileSync(
    path.join(unpackedDir, 'START.bat'),
    '@echo off\r\n' +
    'title Shop ERP\r\n' +
    'cd /d "%~dp0"\r\n' +
    'start "" "Shop ERP.exe"\r\n'
  );

  // Remove old ZIP if exists
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  // Create ZIP — pack unpacked dir as root of ZIP (no subfolder wrapper)
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      const mb = (archive.pointer() / 1024 / 1024).toFixed(1);
      console.log('ZIP created: ' + zipPath + ' (' + mb + ' MB)');
      resolve();
    });
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(unpackedDir, false);
    archive.finalize();
  });

  console.log('\n========================================');
  console.log('  Portable Build Complete!');
  console.log('========================================');
  console.log('\nOutput: release/Shop-ERP-Portable.zip');
  console.log('\nHow to use:');
  console.log('  1. Extract ZIP to USB drive (e.g. E:\\ShopERP\\)');
  console.log('  2. Double-click START.bat to launch');
  console.log('  3. Database saves to ERP-Data\\ on the USB');
  console.log('  4. All data travels with the USB drive\n');
}

buildPortable().catch(err => {
  console.error('Build failed:', err.message);
  process.exit(1);
});
