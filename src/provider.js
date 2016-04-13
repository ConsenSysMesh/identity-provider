import ProviderEngine from 'web3-provider-engine';
import HookedWalletSubprovider from 'web3-provider-engine/subproviders/hooked-wallet';
import Web3Subprovider from 'web3-provider-engine/subproviders/web3';
import * as keystoreLib from './keystore';
import {SubstoreCreator} from './store';
import {Transactable} from './types';


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
        const state = substore.getState();
        const identityAccounts = state.identities.map(id => id.address);
        const keyring = keystoreLib.bestKeyring(state.keystore, state.defaultHdPath);
        callback(null, identityAccounts.concat(keyring.addresses));
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

/**
 * A Web3 provider that can send transactions as the accounts its keystore
 * controls, as well as contract-based identities controlled by keys in
 * the keystore.
 *
 * IdentityProvider is initialized asynchronously, so use
 * IdentityProvider.initialize(...), not new IdentityProvider(...).
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
    let state = this.substore.getState();

    let keystoreExists;
    if (state.keystore == null) {
      keystoreExists = keystoreLib.create(state.passwordProvider)
        .then((keystore) => {
          this.substore.store.dispatch({
            type: 'UPDATE_KEYSTORE',
            keystore: keystore,
          });
        });
    } else {
      keystoreExists = Promise.resolve(state.keystore);
    }

    this.initializedPromise = keystoreExists
      .then(() => keystoreLib.deriveStoreKey(state.passwordProvider))
      .then((storeKey) => {
        state = this.substore.getState();
        this.substore.store.dispatch({
          type: 'UPDATE_KEYSTORE',
          keystore: keystoreLib.ensureHasAddress(state, storeKey),
        });
      })
      .then(() => this);

    this.addProvider(new IdentityWalletSubprovider(this.substore));
    this.addProvider(new Web3Subprovider(state.web3Provider));
  }

  /**
   * Initializes an IdentityProvider asynchronously.
   *
   * @return {Promise<IdentityProvider>}
   */
  static initialize(substoreCreator: SubstoreCreator) {
    const provider = new IdentityProvider(substoreCreator);
    return provider.initializedPromise;
  }
}
