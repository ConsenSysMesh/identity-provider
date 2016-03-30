import t from 'tcomb';


export const Hex = t.refinement(
  t.String,
  (hex) => hex.slice(0, 2) === '0x',
  'Hex'
);

export const Address = t.refinement(
  Hex,
  (address) => address.length === 42,
  'Address'
);

/**
 * Defines an identity with an address and a method to act as the identity on
 * the blockchain.
 *
 * Method versions should be thought of as a way to specify the protocol code that
 * is necessary to interact with the contracts, which will almost always be dependent
 * on the ABI of the proxy and owner contracts that implement the method.
 */
export const Identity = t.struct({
  address: Address,
}, 'Identity');

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

export const OwnerIdentity = t.refinement(
  ContractIdentity.extend({
    owner: Address,
  }),
  (id) => id.methodName.startsWith('owner'),
  'OwnerIdentity'
);
