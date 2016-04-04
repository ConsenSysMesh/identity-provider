import _ from 'lodash';
import t from 'tcomb';
import {Identity} from './base';
import {ContractIdentity} from './Identity';


const IdentityProviderState = t.struct({
  rpcUrl: t.maybe(t.String),
  passwordProvider: t.Function,
  identities: t.list(Identity),
  keystore: t.Any,
}, 'IdentityProviderState');

IdentityProviderState.prototype.identityForAddress = function (address) {
  return _.find(this.identities, (id) => id.address === address);
};

IdentityProviderState.prototype.getKeyIdentity = function () {
  return _.find(this.identities, (id) => !ContractIdentity.is(id));
};

export default IdentityProviderState;
