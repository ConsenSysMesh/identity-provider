export function addIdentity(state, identity) {
  // Add the new identity to the beginning of the array to select it.
  const identities = [identity].concat(state.identities);
  return {
    type: 'UPDATE_IDENTITIES',
    identities,
  };
}
