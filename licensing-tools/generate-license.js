const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Check if keys exist
const privateKeyPath = path.join(__dirname, 'private.pem');
if (!fs.existsSync(privateKeyPath)) {
  console.error('❌ Error: private.pem not found. Run node keygen-setup.js first.');
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Enter the customer\'s System ID: ', (systemId) => {
  if (!systemId) {
    console.error('❌ System ID cannot be empty.');
    rl.close();
    return;
  }

  try {
    const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

    // Create a digital signature of the system ID using the private key
    const sign = crypto.createSign('SHA256');
    sign.update(systemId);
    sign.end();
    
    // The signature itself acts as the license key
    const signature = sign.sign(privateKey, 'base64');
    
    // For convenience, we can bundle the system ID and signature into one string if needed,
    // but usually the signature alone is fine since the app already knows its own System ID.
    console.log('\n✅ License Key generated successfully!\n');
    console.log('Provide the following Activation Key to the customer:');
    console.log('----------------------------------------------------');
    console.log(signature);
    console.log('----------------------------------------------------\n');

  } catch (error) {
    console.error('❌ Error generating license:', error.message);
  }

  rl.close();
});
