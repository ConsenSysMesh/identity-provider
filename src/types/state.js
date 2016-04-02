import _ from 'lodash';
import t from 'tcomb';
import {Identity} from './base';


const IdentityProviderState = t.struct({
  rpcUrl: t.maybe(t.String),
  passwordProvider: t.Function,
  identities: t.list(Identity),
  keystore: t.Any,
}, 'IdentityProviderState');

IdentityProviderState.prototype.identityForAddress = function (address) {
  return _.find(this.identities, (id) => id.address === address);
};

export default IdentityProviderState;
