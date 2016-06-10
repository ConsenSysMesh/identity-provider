import _ from 'lodash';
import t from 'tcomb';


export const State = t.struct({
  identities: t.list(t.Object),
}, 'State');

Object.assign(State.prototype, {
  identityForAddress(address) {
    const identity = _.find(this.identities, (id) => id.address === address);
    return identity;
  },
});
