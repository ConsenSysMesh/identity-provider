import Promise from 'bluebird';
import _ from 'lodash';
import Web3 from 'web3';
import identity from '.';
import * as contracts from './contracts';
import { waitForContract, Transaction } from './lib/transactions';


export function deployProxyContract(from) {
  const options = {
    from,
    data: contracts.Proxy.binary,
  };

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
export function createContractIdentity(from) {
  return deployProxyContract(from)
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
