import HookedWalletSubprovider from 'web3-provider-engine/subproviders/hooked-wallet';
import { PartialState } from './state';
import * as utils from './utils';


export default class KeystoreSubprovider extends HookedWalletSubprovider {
  constructor({ getState }) {
    super({
      getAccounts(callback) {
        const state = PartialState(this.getState()).toState();
        const keyring = utils.bestKeyring(state.keystore, state.defaultHdPath);
        callback(null, keyring.addresses);
      },

      signTransaction(txParams, callback) {
        const state = PartialState(this.getState()).toState();
        const keystore = utils.deserialize(state.keystore);
        keystore.passwordProvider = state.passwordProvider;
        keystore.signTransaction(txParams, callback);
      },
    });
    this.getState = getState;
  }
}
