import Promise from 'bluebird';
import _ from 'lodash';
import Web3 from 'web3';
import identity from '.';
import * as contracts from './contracts';
import {actionCreators} from './store';
import {newContractHooks, Transaction} from './lib/transactions';


export function deployProxyContract(state, from) {
  const options = _.merge({
    from,
    data: contracts.Proxy.binary,
  }, state.transactionDefaults);

  return Transaction({
    options,
    expectedGas: 188561,
    handleTransact(provider) {
      const web3 = new Web3(provider);
      const ProxyABI = web3.eth.contract(contracts.Proxy.abi);
      const {callback, onContractAddress} = newContractHooks();
      ProxyABI.new(this.options, callback);
      return onContractAddress;
    },
  });
}

/**
 * Creates a SenderIdentity owned by the current account.
 *
 * @return {Promise<SenderIdentity>}
 */
export function createContractIdentity(state, from) {
  const deployTx = deployProxyContract(state, from);
  return Transaction({
    ...deployTx,
    handleTransact(provider) {
      return deployTx.transact(provider)
        .then((contract) => {
          return identity.types.SenderIdentity({
            address: contract.address,
            methodName: 'sender',
            methodVersion: '1',
            key: from,
          });
        });
    },
  });
}


/**
 * Create a contract identity and add it to the state.
 */
export function addNewContractIdentity(substore, from) {
  let sender;
  if (from == null) {
    sender = substore.getState().getKeyIdentity().address;
  } else {
    sender = from;
  }

  const createTx = createContractIdentity(substore.getState(), sender);
  return Transaction({
    ...createTx,
    handleTransact(provider) {
      return createTx.transact(provider)
        .then((newIdentity) => {
          substore.store.dispatch(
            actionCreators.addIdentity(newIdentity));
          return newIdentity;
        });
    },
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
