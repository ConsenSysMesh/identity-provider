import _ from 'lodash';

import identity from '.';
import {newContractHooks, txDefaults} from './lib/transactions';


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
