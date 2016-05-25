import Promise from 'bluebird';
import lightwallet from 'eth-lightwallet';
import _ from 'lodash';


export function serialize(keystoreObj) {
  const keystoreString = keystoreObj.serialize();
  return JSON.parse(keystoreString);
}

export function deserialize(keystoreState) {
  const keystoreString = JSON.stringify(keystoreState);
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
 * @returns {Promise<SerializedKeystore>}
 */
export function restoreFromSeed(seed, passwordProvider) {
  return deriveStoreKey(passwordProvider)
    .then(storeKey => new lightwallet.keystore(seed, storeKey))
    .then(serialize);
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

export function bestKeyring(keystore, defaultHdPath) {
  const hdPaths = Object.keys(keystore.ksData);
  let primaryPath;
  if (hdPaths.indexOf(defaultHdPath) !== -1) {
    primaryPath = defaultHdPath;
  } else {
    hdPaths.sort();
    primaryPath = hdPaths[0];
  }

  return {
    hdPath: primaryPath,
    addresses: _.map(
      keystore.ksData[primaryPath].addresses,
      (address) => `0x${address}`),
  };
}

/**
 * If the keystore has no addresses generated, generate one.
 */
export function ensureHasAddress(state, storeKey) {
  const keyring = bestKeyring(state.keystore, state.defaultHdPath);
  const keystore = deserialize(state.keystore);
  if (keyring.addresses.length === 0) {
    keystore.generateNewAddress(storeKey, 1, state.defaultHdPath);
  }
  return serialize(keystore);
}
