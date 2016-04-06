import _ from 'lodash';
import t from 'tcomb';
import {ContractIdentity} from '../types/identity';


export const State = t.struct({
  web3Provider: t.Any,
  passwordProvider: t.Function,
  identities: t.list(t.Any),
  keystore: t.Any,
}, 'IdentityProviderState');

State.prototype.identityForAddress = function (address) {
  return _.find(this.identities, (id) => id.address === address);
};

State.prototype.getKeyIdentity = function () {
  return _.find(this.identities, (id) => !ContractIdentity.is(id));
};
