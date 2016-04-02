import lightwallet from 'eth-lightwallet';
import Promise from 'bluebird';


export function constructFromState(state) {
  const keystoreString = JSON.stringify(state.keystore);
  return lightwallet.keystore.deserialize(keystoreString);
}

export function deriveStoreKey(passwordProvider) {
  return Promise.promisify(passwordProvider)()
    .then(Promise.promisify(lightwallet.keystore.deriveKeyFromPassword));
}

/**
 * Restore a keystore from a seed.
 *
 * Restored keystores don't contain any addresses. ensureHasAddress will
 * generate a single address. If your users' seeds have been used to generate
 * multiple addresses, you'll need to come up with a way to regenerate them.
 * BIP44 outlines this process for wallets, but detecting an unused key is
 * harder in Ethereum because there's an infinite state space of contracts to
 * check for key references. HD token wallets constrain this state space using
 * per-token HD paths (https://github.com/ethereum/EIPs/issues/85).
 *
 * @returns {Promise<KeyStore>}
 */
export function restoreFromSeed(seed, passwordProvider) {
  return deriveStoreKey(passwordProvider)
    .then(storeKey => new lightwallet.keystore(seed, storeKey));
}

/**
 * Create a keystore using a random key with optional extraEntropy.
 *
 * @returns {Promise<KeyStore>}
 */
export function create(passwordProvider, extraEntropy) {
  const seed = lightwallet.keystore.generateRandomSeed(extraEntropy);
  return restoreFromSeed(seed, passwordProvider);
}

function bestKeystorePath(keystore) {
  const hdPaths = Object.keys(keystore.ksData);
  let primaryPath;
  if (hdPaths.indexOf(keystore.defaultHdPathString) !== -1) {
    primaryPath = keystore.defaultHdPathString;
  } else {
    hdPaths.sort();
    primaryPath = hdPaths[0];
  }

  return {
    hdPath: primaryPath,
    addresses: keystore.ksData[primaryPath].addresses,
  };
}

/**
 * If the keystore has no addresses generated, generate one.
 */
export function ensureHasAddress(keystore, storeKey) {
  const pathInfo = bestKeystorePath(keystore);
  if (pathInfo.addresses.length === 0) {
    keystore.generateNewAddress(storeKey, 1, pathInfo.hdPath);
  }
}
