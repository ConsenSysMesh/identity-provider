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


const deriveStoreKey = Promise.promisify(lightwallet.keystore.deriveKeyFromPassword);

function deriveInsecureStoreKey() {
  // Using a hardcoded password is equivalent to storing keys unencrypted.
  const insecurePassword = 'identity-provider';
  return deriveStoreKey(insecurePassword);
}

const seed = 'embark can decline fence confirm salute fence weird joy camp brown embrace';
const providerPromise = deriveInsecureStoreKey()
  .then((storeKey) => {
    const keystore = new lightwallet.keystore(seed, storeKey);
    return identity.provider.IdentityProvider.initialize({
      keystore,
      identities: [],
      passwordProvider: (callback) => callback(null, 'identity-provider'),
    });
  });

providerPromise.then((provider) => {
  console.log(provider.config.identities);
  provider.start();
  provider.createContractIdentity()
    .then(() => {
      console.log(provider.config.identities);
    })
    .catch((err) => {
      throw err;
    });
  provider.stop();
});
