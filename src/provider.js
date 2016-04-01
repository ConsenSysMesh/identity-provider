import Promise from 'bluebird';
import lightwallet from 'eth-lightwallet';
import _ from 'lodash';
import t from 'tcomb';
import Web3 from 'web3';
import ProviderEngine from 'web3-provider-engine';
import HookedWalletSubprovider from 'web3-provider-engine/subproviders/hooked-wallet';
import Web3Subprovider from 'web3-provider-engine/subproviders/web3';
import * as actions from './actions';
import * as configLib from './config';
import * as types from './types';

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
        // TODO: Check fullTxParams.from against config.identities to see if
        // a contract identity is being used, then handle it accordingly using
        // the appropriate Signer from ConsenSys/eth-lightwallet#75.
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

function deriveStoreKey(passwordProvider) {
  return Promise.promisify(passwordProvider)()
    .then(Promise.promisify(lightwallet.keystore.deriveKeyFromPassword));
}

/**
 * If the keystore has no addresses generated, generate one.
 */
function ensureKeystoreHasAddress(keystore, storeKey) {
  const pathInfo = bestKeystorePath(keystore);
  if (pathInfo.addresses.length === 0) {
    keystore.generateNewAddress(storeKey, 1, pathInfo.hdPath);
  }
}

function mergeIdentitySources(identities, keystore) {
  const knownAddresses = new Set(identities.map((id) => id.address));
  const keystoreAddresses = keystore.ksData[keystore.defaultHdPathString].addresses.map((addr) => `0x${addr}`);
  const missingIdentities = keystoreAddresses.reduce((found, address) => {
    if (!knownAddresses.has(address)) {
      found.push(types.Identity({address}));
    }
    return found;
  }, []);
  return identities.concat(missingIdentities);
}

/**
 * A Web3 provider that can send transactions as the accounts its keystore
 * controls, as well as contract-based identities controlled by keys in
 * the keystore.
 */
export class IdentityProvider extends ProviderEngine {
  constructor(config: IdentityProviderConfig) {
    super();
    this.config = _.cloneDeep(config); // Clone the immutable config to allow mutation as a stopgap.

    this.initializedPromise = deriveStoreKey(this.config.passwordProvider)
      .then((storeKey) => {
        ensureKeystoreHasAddress(this.config.keystore, storeKey);
        this.config.identities = mergeIdentitySources(this.config.identities, this.config.keystore);
      })
      .then(() => this);

    this.addProvider(new IdentityWalletSubprovider(this.config));
    this.addProvider(new Web3Subprovider(
      new Web3.providers.HttpProvider(this.config.rpcUrl || DEFAULT_RPC_URL)));
  }

  static initialize(config) {
    const provider = new IdentityProvider(config);
    return provider.initializedPromise;
  }

  createContractIdentity(from) {
    let sender;
    if (from == null) {
      const keyIdentity = _.find(this.config.identities, (id) => !types.ContractIdentity.is(id));
      sender = keyIdentity.address;
    } else {
      sender = from;
    }

    const txConfig = Object.assign({
      account: sender,
      web3: new Web3(this),
    }, configLib.defaultConfig);
    return actions.createContractIdentity(txConfig)
      .then((newIdentity) => {
        // Add the new identity to the beginning of the array to select it.
        this.config.identities.unshift(newIdentity);
        return newIdentity;
      });
  }
}
