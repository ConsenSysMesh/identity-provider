import invariant from 'invariant';
import Web3 from 'web3';
import SubProvider from 'web3-provider-engine/subproviders/subprovider';
import { State } from './state';
import { Identity } from './types';


export default class IdentitySubprovider extends SubProvider {
  constructor({ getState }) {
    super();
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
      invariant(originalTxOptions.from != null,
        'IdentitySubprovider transactions must have a from address.');
      const state = State(this.getState());
      const identity = state.identityForAddress(originalTxOptions.from);
      const newTxOptions = Identity(identity).wrapTransaction(originalTxOptions);

      const web3 = new Web3(state.signingProvider);
      web3.eth.sendTransaction(newTxOptions, end);
      return;

    default:
      next();
      return;
    }
  }
}
