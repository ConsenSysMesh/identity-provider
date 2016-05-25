import BN from 'bn.js';
import abi from 'ethereumjs-abi';
import utils from 'ethereumjs-util';
import t from 'tcomb';
import { Address, BaseIdentity } from './base';


export const ContractIdentityMethod = t.enums({
  'sender': true,
  'owner.metatx': true,
});

/**
 * Defines a contract identity with a method to act as the identity on the
 * blockchain.
 *
 * Method versions should be thought of as a way to specify the protocol code that
 * is necessary to interact with the contracts, which will almost always be dependent
 * on the ABI of the proxy and owner contracts that implement the method.
 */
export const ContractIdentity = BaseIdentity.extend({
  methodName: ContractIdentityMethod,
  methodVersion: t.String,
  key: Address,
}, 'ContractIdentity');

Object.assign(ContractIdentity.prototype, {
  getGasAddress() {
    return this.key;
  },

  wrapTransaction(txParams) {
    // Generate the data for the proxy contract call.
    // FIXME: ethereumjs-abi handles 0x-prefixed numbers in master, but not in 0.5.0.
    const forwardArgs = [
      new BN(utils.stripHexPrefix(txParams.to), 16),
      new BN(utils.stripHexPrefix(txParams.value), 16),
      utils.toBuffer(txParams.data),
    ];
    const outerTxData = abi.rawEncode(
      'forward', ['address', 'uint256', 'bytes'], forwardArgs);

    // Insert the proxy contract call data in a new transaction sent from the
    // specified identity.
    const newParams = {
      data: `0x${outerTxData.toString('hex')}`,
      to: this.address,
      from: this.key,
    };
    // If gasPrice or gasLimit were set, copy them over.
    // TODO: It is more accurate to add the ProxyContract.forward gas cost overhead
    // to the provided gasLimit as long as it's less than the block gas limit.
    ['gasPrice', 'gasLimit'].forEach((param) => {
      if (txParams[param] != null) {
        newParams[param] = txParams[param];
      }
    });

    return newParams;
  },
});

export const SenderIdentity = t.refinement(
  ContractIdentity,
  (id) => id.methodName === 'sender',
  'SenderIdentity'
);

// NOTE: Owner identities that allow any sender to submit a metatransaction
// signed by the owner are not currently implemented.
export const OwnerIdentity = t.refinement(
  ContractIdentity.extend({
    owner: Address,
  }),
  (id) => id.methodName.startsWith('owner'),
  'OwnerIdentity'
);

/**
 * A union of all identity types.
 */
export const Identity = t.union([SenderIdentity, OwnerIdentity], 'Identity');
Identity.dispatch = function (data) {
  const contractMethods = {
    'sender': SenderIdentity,
    'owner.metatx': OwnerIdentity,
  };
  return contractMethods[data.methodName];
};
