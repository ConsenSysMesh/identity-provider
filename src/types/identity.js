import abi from 'ethereumjs-abi';
import _ from 'lodash';
import t from 'tcomb';
import {Address, Identity} from './base';
import * as keystoreLib from '../keystore';

export const KeystoreIdentity = Identity.extend({}, 'KeystoreIdentity');
Identity.registerContractMethod(KeystoreIdentity);

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
Identity.registerContractMethod(SenderIdentity);

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

/**
 * Cast an Identity instance to its appropriate subtype.
 *
 * FIXME: It's odd to separate this from the definition of Identity, but since
 * it needs KeystoreIdentity, this might be the best option that avoids a
 * circular import.
 */
Identity.prototype.asSubtype = function () {
  const allMethods = Identity.contractMethods.concat(KeystoreIdentity);
  const matchers = allMethods.map((Type) => [Type, (instance) => Type(instance)]);
  return t.match(this, ..._.flatten(matchers));
};
