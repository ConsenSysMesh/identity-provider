import lightwallet from 'eth-lightwallet';
import identity from '../src';
import Promise from 'bluebird';
global.Promise = Promise;  // Use bluebird for better error logging during development.

/**
 * 1. Create or load a keystore and identity definitions.
 * 2. Create a provider from a keystore, identity definitions, and an RPC URL.
 * 3. Find the first contract identity. Create one if none exist.
 * 4. Set that identity as active in the provider.
 */

function deriveStoreKey(password) {
  return new Promise((resolve, reject) => {
    lightwallet.keystore.deriveKeyFromPassword(password, (err, storeKey) => {
      if (err) {
        reject(err);
      } else {
        resolve(storeKey);
      }
    });
  });
}

function deriveInsecureStoreKey() {
  // Using a hardcoded password is equivalent to storing keys unencrypted.
  const insecurePassword = 'password';
  return deriveStoreKey(insecurePassword);
}

const seed = 'embark can decline fence confirm salute fence weird joy camp brown embrace';
const serializedKeystorePromise = deriveInsecureStoreKey()
  .then((storeKey) => {
    const keystore = lightwallet.keystore(seed, storeKey);
    return JSON.parse(keystore.serialize());
  });

serializedKeystorePromise
  .then(lightwallet.keystore.deserialize)
  .then((keystore) => {

  })

/*
identity.config.initialize().then((config) => {
  return identity.actions.createSenderIdentity(config)
    .then((id) => {
      console.log(id);
    });
});
*/
