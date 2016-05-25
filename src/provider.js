import Web3 from 'web3';
import ProviderEngine from 'web3-provider-engine';
import HookedWalletSubprovider from 'web3-provider-engine/subproviders/hooked-wallet';
import SubProvider from 'web3-provider-engine/subproviders/subprovider';
import Web3Subprovider from 'web3-provider-engine/subproviders/web3';
import * as keystoreLib from './keystore';
import { SubstoreCreator } from './store';
import { State, Transactable } from './types';


export class IdentitySubprovider extends SubProvider {
  constructor(getState) {
    this.getState = getState;
  }

  getAccounts() {
    const state = this.getState();
    return state.identities.map(id => id.address);
  }

  handleRequest(payload, next, end) {
    switch (payload.method) {
    case 'eth_coinbase':
      end(null, this.getAccounts()[0]);
      return;

    case 'eth_accounts':
      end(null, this.getAccounts());
      return;

    case 'eth_sendTransaction':
      const originalTxOptions = payload.params[0];
      const state = State(this.getState());
      const identity = state.identityForAddress(originalTxOptions.from);
      const newTxOptions = Transactable(identity).wrapTransaction(originalTxOptions);

      const web3 = new Web3(state.signingProvider);
      web3.eth.sendTransaction(newTxOptions, end);
      return;

    default:
      next();
      return;
    }
  }
}

export class KeystoreSubprovider extends HookedWalletSubprovider {
  constructor(getState) {
    super({
      getAccounts(callback) {
        const state = this.getState();
        const keyring = keystoreLib.bestKeyring(state.keystore, state.defaultHdPath);
        callback(null, keyring.addresses);
      },

      signTransaction(txParams, callback) {
        const state = this.getState();
        const keystore = keystoreLib.deserialize(state.keystore);
        keystore.passwordProvider = state.passwordProvider;
        keystore.signTransaction(txParams, callback);
      },
    });
    this.getState = getState;
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
