import _ from 'lodash';
import t from 'tcomb';
import Web3 from 'web3';
import ProviderEngine from 'web3-provider-engine';
import HookedWalletSubprovider from 'web3-provider-engine/subproviders/hooked-wallet';
import Web3Subprovider from 'web3-provider-engine/subproviders/web3';
import * as actions from './actions';
import * as configLib from './config';
import * as keystoreLib from './keystore';
import {Identity, IdentityProviderState, Transactable} from './types';


export class IdentityWalletSubprovider extends HookedWalletSubprovider {
  constructor(state: IdentityProviderState) {
    super({
      getAccounts(callback) {
        callback(null, state.identities.map(id => id.address));
      },

      approveTransaction(txParams, callback) {
        callback(null, true);
      },

      signTransaction(fullTxParams, callback) {
        const sender = fullTxParams.from;
        const identity = IdentityProviderState(state).identityForAddress(sender);
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
  constructor(state: IdentityProviderState) {
    super();
    this.state = _.cloneDeep(state); // Clone the immutable state to allow mutation as a stopgap.

    this.initializedPromise = keystoreLib.deriveStoreKey(this.state.passwordProvider)
      .then((storeKey) => {
        keystoreLib.ensureHasAddress(this.state.keystore, storeKey);
        this.state.identities = mergeIdentitySources(this.state.identities, this.state.keystore);
      })
      .then(() => this);

    this.addProvider(new IdentityWalletSubprovider(this.state));
    this.addProvider(new Web3Subprovider(this.state.web3Provider));
  }

  static initialize(state) {
    const provider = new IdentityProvider(state);
    return provider.initializedPromise;
  }

  createContractIdentity(from) {
    let sender;
    if (from == null) {
      sender = IdentityProviderState(this.state).getKeyIdentity().address;
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
        this.state.identities = [newIdentity].concat(this.state.identities);
        return newIdentity;
      });
  }
}
