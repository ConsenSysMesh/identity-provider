import Web3 from 'web3';
import ProviderEngine from 'web3-provider-engine';
import HookedWalletSubprovider from 'web3-provider-engine/subproviders/hooked-wallet';
import Web3Subprovider from 'web3-provider-engine/subproviders/web3';
import * as actions from './actions';
import * as configLib from './config';
import * as keystoreLib from './keystore';
import {SubstoreCreator} from './store';
import {Identity, Transactable} from './types';


export class IdentityWalletSubprovider extends HookedWalletSubprovider {
  // TODO: Move away from HookedWalletSubprovider. HookedWalletSubprovider is
  // intended for providers that will always sign transactions internally, but
  // IdentityProvider should allow manipulated but unsigned transactions to be
  // passed to other subproviders. This requires another feature that would
  // be nice: the ability to call next() inside handleRequest to allow other
  // subproviders to handle addresses that aren't controlled by this subprovider.
  constructor(substore) {
    super({
      getAccounts(callback) {
        callback(null, substore.getState().identities.map(id => id.address));
      },

      approveTransaction(txParams, callback) {
        callback(null, true);
      },

      signTransaction(fullTxParams, callback) {
        const sender = fullTxParams.from;
        const state = substore.getState();
        const identity = state.identityForAddress(sender);
        Transactable(identity).signTransaction(fullTxParams, state, callback);
      },
    });
  }
}

function mergeIdentitySources(identities, keystore) {
  const knownAddresses = new Set(identities.map((id) => id.address));
  const keystoreAddresses = keystore.ksData[keystore.defaultHdPathString].addresses.map((addr) => `0x${addr}`);
  const missingIdentities = keystoreAddresses.reduce((found, address) => {
    if (!knownAddresses.has(address)) {
      found.push(Identity({address}));
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
  // TODO: It would be nice to keep synthetic identities completely separate
  // from the keystore in its own subprovider, but the architecture of
  // provider-engine doesn't make it easy for multiple subproviders to
  // contribute values to the same RPC call, e.g. getAddresses would need
  // synthetic identities as well as keystore identities. IdentityProvider
  // is a stopgap that combines the two.
  constructor(substoreCreator: SubstoreCreator) {
    super();
    this.substore = SubstoreCreator(substoreCreator).getSubstore();
    const state = this.substore.getState();

    this.initializedPromise = keystoreLib.deriveStoreKey(state.passwordProvider)
      .then((storeKey) => {
        keystoreLib.ensureHasAddress(state.keystore, storeKey);
        const identities = mergeIdentitySources(state.identities, state.keystore);
        this.substore.store.dispatch({
          type: 'UPDATE_IDENTITIES',
          identities,
        });
      })
      .then(() => this);

    this.addProvider(new IdentityWalletSubprovider(this.substore));
    this.addProvider(new Web3Subprovider(state.web3Provider));
  }

  static initialize(substoreCreator: SubstoreCreator) {
    const provider = new IdentityProvider(substoreCreator);
    return provider.initializedPromise;
  }

  /**
   * Create a contract identity and add it to the state.
   */
  createContractIdentity(from) {
    let sender;
    if (from == null) {
      sender = this.substore.getState().getKeyIdentity().address;
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
        const identities = [newIdentity].concat(this.substore.getState().identities);
        this.substore.store.dispatch({
          type: 'UPDATE_IDENTITIES',
          identities,
        });
        return newIdentity;
      });
  }
}
