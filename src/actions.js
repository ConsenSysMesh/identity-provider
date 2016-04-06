import Promise from 'bluebird';
import _ from 'lodash';
import Web3 from 'web3';
import identity from '.';
import * as contracts from './contracts';
import {newContractHooks} from './lib/transactions';


export function deployProxyContract(state, from, provider) {
  const web3 = new Web3(provider);
  const ProxyABI = web3.eth.contract(contracts.Proxy.abi);
  const {callback, onContractAddress} = newContractHooks();
  const txParams = _.merge({
    from,
    data: contracts.Proxy.binary,
  }, state.transactionDefaults);
  ProxyABI.new(txParams, callback);

  return onContractAddress;
}

/**
 * Creates a SenderIdentity owned by the current account.
 *
 * @return {Promise<SenderIdentity>}
 */
export function createContractIdentity(state, from, provider) {
  return deployProxyContract(state, from, provider).then((contract) => {
    return identity.types.SenderIdentity({
      address: contract.address,
      methodName: 'sender',
      methodVersion: '1',
      key: from,
    });
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
