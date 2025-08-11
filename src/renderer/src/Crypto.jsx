// Group key generation
export async function generateUserKeypair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  return keyPair; // { publicKey, privateKey }
}

export async function savePrivateKey(privateKey, userId) {
  const exported = await window.crypto.subtle.exportKey("pkcs8", privateKey);
  const request = indexedDB.open("group-private-keys", 1);

  request.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains("keys")) {
      db.createObjectStore("keys");
    }
  };

  request.onerror = () => {
    console.log("Error creating database");
  };

  request.onsuccess = (e) => {
    const db = e.target.result;
    const transaction = db.transaction(["keys"], "readwrite");
    const store = transaction.objectStore("keys");
    store.put(exported, userId);
    transaction.oncomplete = () => {
      db.close();
    };
  };
}

export async function retrievePrivateKey(userId) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("group-private-keys", 1);

    request.onerror = () => {
      reject("Error opening IndexedDB");
    };

    request.onsuccess = (e) => {
      const db = e.target.result;
      const transaction = db.transaction(["keys"], "readonly");
      const store = transaction.objectStore("keys");
      const getRequest = store.get(userId);

      getRequest.onsuccess = async () => {
        const exported = getRequest.result;
        if (!exported) {
          db.close();
          return resolve(null);
        }
        try {
          const privateKey = await window.crypto.subtle.importKey(
            "pkcs8",
            exported,
            {
              name: "RSA-OAEP",
              hash: "SHA-256",
            },
            true,
            ["decrypt"]
          );
          db.close();
          resolve(privateKey);
        } catch (err) {
          db.close();
          reject(err);
        }
      };

      getRequest.onerror = () => {
        db.close();
        reject("Error retrieving key");
      };
    };
  });
}

export async function createGroupKey() {
  const groupKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const rawGroupKey = await window.crypto.subtle.exportKey("raw", groupKey);

  return rawGroupKey;
}

export async function decryptGroupKey(encryptedGroupKey, memberPrivateKey) {
  const rawGroupKey = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    memberPrivateKey,
    encryptedGroupKey
  );

  const groupKey = await window.crypto.subtle.importKey(
    "raw",
    rawGroupKey,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );

  return groupKey;
}

// Message encryption

export async function encryptMessage(plaintext, groupKey) {
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = enc.encode(plaintext);

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    groupKey,
    encoded
  );

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

export async function decryptMessage(ciphertextB64, ivB64, groupKey) {
  const dec = new TextDecoder();
  const ciphertext = Uint8Array.from(atob(ciphertextB64), (c) =>
    c.charCodeAt(0)
  );
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));

  const plaintext = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    groupKey,
    ciphertext
  );

  return dec.decode(plaintext);
}
