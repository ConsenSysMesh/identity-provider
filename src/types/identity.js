import abi from 'ethereumjs-abi';
import Transaction from 'ethereumjs-tx';
import {addHexPrefix} from 'ethereumjs-util';
import t from 'tcomb';
import {Address, Identity} from './base';
import IdentityProviderState from './state';
import * as keystoreLib from '../keystore';

export const KeystoreIdentity = Identity.extend({}, 'KeystoreIdentity');

KeystoreIdentity.prototype.signTransaction = function (txParams, providerState, callback) {
  const keystore = keystoreLib.constructFromState(providerState);
  keystore.passwordProvider = providerState.passwordProvider;
  keystore.signTransaction(txParams, callback);
};

export const ContractIdentityMethod = t.enums({
  'sender': true,
  'owner.metatx': true,
});

export const ContractIdentity = Identity.extend({
  methodName: ContractIdentityMethod,
  methodVersion: t.String,
  key: Address,
}, 'ContractIdentity');

export const SenderIdentity = t.refinement(
  ContractIdentity,
  (id) => id.methodName === 'sender',
  'SenderIdentity'
);

SenderIdentity.prototype.signTransaction = function (txParams, providerState, callback) {
  // Generate the data for the proxy contract call.
  const outerTxData = abi.rawEncode(
    'forward',
    ['address', 'uint256', 'bytes'],
    [txParams.to, txParams.value, txParams.data]
  );

  // Insert the proxy contract call data in a new transaction sent from the
  // specified identity.
  KeystoreIdentity({address: this.key}).signTransaction({
    'data': outerTxData,
    'gasPrice': txParams.gasPrice,
    'gasLimit': txParams.gasLimit,
    'value': 0,
    'nonce': 1,
    'to': this.address,
  }, providerState, callback);
};

export const OwnerIdentity = t.refinement(
  ContractIdentity.extend({
    owner: Address,
  }),
  (id) => id.methodName.startsWith('owner'),
  'OwnerIdentity'
);
