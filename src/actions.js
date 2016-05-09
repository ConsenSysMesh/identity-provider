import Promise from 'bluebird';
import _ from 'lodash';
import Web3 from 'web3';
import identity from '.';
import * as contracts from './contracts';
import { actionCreators } from './store';
import { waitForContract, Transaction } from './lib/transactions';


export function deployProxyContract(from, { transactionDefaults }) {
  const options = _.merge({
    from,
    data: contracts.Proxy.binary,
  }, transactionDefaults);

  // Since the contract constructor takes no arguments, we can use sendTransaction
  // directly instead of using Contract.new, which is buggy.
  return Transaction({
    options,
    expectedGas: 188561,
  }).map((txhash, provider) => {
    const web3 = new Web3(provider);
    const ProxyABI = web3.eth.contract(contracts.Proxy.abi);
    return waitForContract(ProxyABI, txhash, provider);
  });
}

/**
 * Creates a SenderIdentity owned by the current account.
 *
 * @return {Transaction}
 */
export function createContractIdentity(from, { transactionDefaults }) {
  return deployProxyContract(from, { transactionDefaults })
    .map((contract) => {
      return identity.types.SenderIdentity({
        address: contract.address,
        methodName: 'sender',
        methodVersion: '1',
        key: from,
      });
    });
}


/**
 * Create a contract identity and add it to the state.
 *
 * @return {Transaction}
 */
export function addNewContractIdentity(substore, from) {
  let sender;
  if (from == null) {
    sender = substore.getState().getKeyIdentity().address;
  } else {
    sender = from;
  }

  return createContractIdentity(sender, substore.getState())
    .map((newIdentity) => {
      substore.store.dispatch(
        actionCreators.addIdentity(newIdentity));
      return newIdentity;
    });
}

/**
 * Fund the given address with ether from an account on an RPC node.
 *
 * TestRPC's accounts start with funds we can use to bootstrap a new identity.
 * In the real world, the key identity will need funds from ShapeShift or a
 * user's preexisting ether wallet.
 */
export function fundAddressFromNode(address, wei, provider) {
  const web3 = new Web3(provider);
  const getAccounts = Promise.promisify(web3.eth.getAccounts);
  const sendTransaction = Promise.promisify(web3.eth.sendTransaction);
  return getAccounts()
    .then((accounts) => {
      return sendTransaction({
        from: accounts[0],
        to: address,
        value: wei,
      });
    });
}
