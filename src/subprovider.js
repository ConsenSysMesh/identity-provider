import invariant from 'invariant';
import Web3 from 'web3';
import SubProvider from 'web3-provider-engine/subproviders/subprovider';
import { State } from './state';
import { Identity } from './types';


export default class IdentitySubprovider extends SubProvider {
  constructor({ getEnvironment }) {
    super();
    this.getEnvironment = getEnvironment;
  }

  getAccounts() {
    const state = this.getEnvironment().state;
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
      const environment = this.getEnvironment();
      const state = State(environment.state);
      const identity = state.identityForAddress(originalTxOptions.from);
      invariant(identity != null,
        `The transaction's from address (${originalTxOptions.from}) didn't match an identity we control.`)
      const newTxOptions = Identity(identity).wrapTransaction(originalTxOptions);

      const web3 = new Web3(environment.dependencies.signingProvider);
      web3.eth.sendTransaction(newTxOptions, end);
      return;

    default:
      next();
      return;
    }
  }
}
