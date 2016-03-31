import Promise from 'bluebird';
import lightwallet from 'eth-lightwallet';
import t from 'tcomb';
import Web3 from 'web3';
import ProviderEngine from 'web3-provider-engine';
import HookedWalletSubprovider from 'web3-provider-engine/subproviders/hooked-wallet';
import Web3Subprovider from 'web3-provider-engine/subproviders/web3';

const DEFAULT_RPC_URL = 'http://localhost:8545';

const IdentityProviderConfig = t.struct({
  rpcUrl: t.maybe(t.String),
  passwordProvider: t.Function,
  keystore: t.Any,
  identities: t.Any,
}, 'IdentityProviderConfig');


export class IdentityWalletSubprovider extends HookedWalletSubprovider {
  constructor(config: IdentityProviderConfig) {
    super({
      getAccounts(callback) {
        callback(null, config.identities.map(id => id.address));
      },

      approveTransaction(txParams, callback) {
        callback(null, true);
      },

      signTransaction(fullTxParams, callback) {
        const keystoreString = JSON.stringify(config.keystore);
        const keystore = lightwallet.keystore.deserialize(keystoreString);
        keystore.passwordProvider = config.passwordProvider;
        keystore.signTransaction(fullTxParams, callback);
      },
    });
  }
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
function ensureKeystoreHasAddress(keystore, passwordProvider): Promise {
  const pathInfo = bestKeystorePath(keystore);
  if (pathInfo.addresses.length === 0) {
    return Promise.promisify(passwordProvider)()
      .then(Promise.promisify(lightwallet.keystore.deriveKeyFromPassword))
      .then((storeKey) => {
        keystore.generateNewAddress(storeKey, 1, pathInfo.hdPath);
      });
  }
  return Promise.resolve();
}

/**
 * A Web3 provider that can send transactions as the accounts its keystore
 * controls, as well as contract-based identities controlled by keys in
 * the keystore.
 */
export class IdentityProvider extends ProviderEngine {
  constructor(config: IdentityProviderConfig) {
    super();
    ensureKeystoreHasAddress(config.keystore, config.passwordProvider);
    // TODO: Ensure that all keystore addresses from the best HD path are
    // included in config.identities.
    this.addProvider(new IdentityWalletSubprovider(config));
    this.addProvider(new Web3Subprovider(
      new Web3.providers.HttpProvider(config.rpcUrl || DEFAULT_RPC_URL)));
  }
}
