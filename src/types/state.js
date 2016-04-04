import _ from 'lodash';
import t from 'tcomb';
import {ContractIdentity} from './identity';


const IdentityProviderState = t.struct({
  web3Provider: t.Any,
  passwordProvider: t.Function,
  identities: t.list(t.Any),
  keystore: t.Any,
}, 'IdentityProviderState');

IdentityProviderState.prototype.identityForAddress = function (address) {
  return _.find(this.identities, (id) => id.address === address);
};

IdentityProviderState.prototype.getKeyIdentity = function () {
  return _.find(this.identities, (id) => !ContractIdentity.is(id));
};

export default IdentityProviderState;
