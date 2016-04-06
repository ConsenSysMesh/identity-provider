import t from 'tcomb';


export const UPDATE_IDENTITIES = t.struct({
  identities: t.list(t.Any),
}, 'UpdateIdentities');

UPDATE_IDENTITIES.prototype.patch = function (state) {
  return t.update(state, {identities: {$set: this.identities}});
};
