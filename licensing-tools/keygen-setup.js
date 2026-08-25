const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Generate an RSA key pair
crypto.generateKeyPair('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
}, (err, publicKey, privateKey) => {
  if (err) {
    console.error('Error generating key pair:', err);
    return;
  }

  // Save the keys to the current directory
  fs.writeFileSync(path.join(__dirname, 'public.pem'), publicKey);
  fs.writeFileSync(path.join(__dirname, 'private.pem'), privateKey);

  console.log('✅ Keys generated successfully!');
  console.log('⚠️  WARNING: Keep private.pem strictly confidential. Never include it in the app build.');
  console.log('ℹ️  public.pem should be copied to the main application source code so it can verify licenses.');
});
