export async function importPrivateKey(pem) {
  // fetch the part of the PEM string between header and footer
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  
  if (!pem.includes(pemHeader) || !pem.includes(pemFooter)) {
    throw new Error("Invalid PEM format. Must include BEGIN and END PRIVATE KEY headers.");
  }
  
  const pemContents = pem.substring(
    pem.indexOf(pemHeader) + pemHeader.length,
    pem.indexOf(pemFooter)
  ).replace(/\s/g, ''); // remove all whitespace/newlines
  
  // base64 decode the string to get the binary data
  const binaryDerString = window.atob(pemContents);
  
  // convert from a binary string to an ArrayBuffer
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  return await window.crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    true,
    ["sign"]
  );
}

export async function signSystemId(privateKey, systemId) {
  const encoder = new TextEncoder();
  const data = encoder.encode(systemId);
  
  const signature = await window.crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    data
  );
  
  // Convert signature ArrayBuffer to base64 string
  const uint8Array = new Uint8Array(signature);
  const binaryString = String.fromCharCode.apply(null, uint8Array);
  return window.btoa(binaryString);
}
