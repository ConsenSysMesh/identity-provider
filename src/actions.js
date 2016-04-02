import Promise from 'bluebird';
import _ from 'lodash';
import Web3 from 'web3';
import identity from '.';
import * as constants from './constants';
import {newContractHooks, txDefaults, waitForReceipt} from './lib/transactions';


export function deployProxyContract(config) {
  const ProxyABI = config.web3.eth.contract(config.contracts.Proxy.abi);
  const hooks = newContractHooks();
  ProxyABI.new(
    _.merge({
      data: config.contracts.Proxy.binary,
    }, txDefaults(config)),
    hooks.callback);

  return hooks.onContractAddress;
}

/**
 * Creates a SenderIdentity owned by the current account.
 *
 * @return {Promise<SenderIdentity>}
 */
export function createContractIdentity(config) {
  return deployProxyContract(config).then((contract) => {
    return identity.types.SenderIdentity({
      address: contract.address,
      methodName: 'sender',
      methodVersion: '1',
      key: config.account,
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
export function fundAddressFromNode(address, wei, rpcUrl = constants.DEFAULT_RPC_URL) {
  const web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
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
