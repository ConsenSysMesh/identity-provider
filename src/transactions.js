import Promise from 'bluebird';
import _ from 'lodash';
import Transaction, { utils } from 'transaction-monad';
import Web3 from 'web3';
import identity from '.';
import * as contracts from './contracts';


/**
 * Deploy a proxy contract from uport-proxy.
 *
 * @return {Transaction<Address>}
 */
export function deployProxyContract(from) {
  const options = {
    from,
    data: contracts.Proxy.binary,
  };

  // NOTE: Transactions that deploy contracts typically require a handleTransact
  // method. Since the contract constructor takes no arguments, we can use a
  // plain Transaction.
  return Transaction({
    options,
    expectedGas: 188561,
  }).map((txhash, provider) => utils.waitForContract(txhash, provider));
}

/**
 * Creates a SenderIdentity owned by the current account.
 *
 * @return {Transaction<SenderIdentity>}
 */
export function createContractIdentity(from) {
  return deployProxyContract(from)
    .map((address) => {
      return identity.types.SenderIdentity({
        address,
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
