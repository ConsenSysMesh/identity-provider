identity-provider
=================

`identity-provider` is a Web3 `Provider` for interacting with Ethereum accounts
that represent persistent identities. It uses `web3-provider-engine` to intercept
account-related RPC calls, and it uses `eth-lightwallet` to manage an HD keystore.
Once a key has been funded, `identity-provider` can create a contract-based
identity by deploying `uport-proxy`'s' proxy contract and maintaining relevant
metadata to allow transactions to be sent as that identity.

Example
-------

```
// Don't use a hardcoded password like this unless insecure keys are acceptable.
const passwordProvider = (callback) => callback(null, 'identity-provider'),
const providerPromise = identity.keystore.create(passwordProvider)
  .then((keystore) => {
    return identity.provider.IdentityProvider.initialize({
      keystore,
      identities: [],
      passwordProvider,
    });
  });

providerPromise.then((provider) => {
  const web3 = new Web3(provider);
  ...
  // After adding funds to the key identity, you can use it to create a contract
  // identity.
  const keyIdentity = provider.config.identities[0]; // Add funds to keyIdentity.address.

  provider.createContractIdentity()
    .then((contractIdentity) => {
      // Now you have a contract identity. contractIdentity.address can be passed
      // as the `from` parameter in web3 transaction objects, and identity-provider
      // will (soon) manipulate the transaction appropriately to send it for you.
      web3.eth.sendTransaction({from: contractIdentity.address, ...});
  });
});
```

TODO
----

- Use eth-lightwallet's ProxySigner to send transactions as a contract identity.
- Use redux to make identity-provider's state easy for applications to consume.

Future Directions
-----------------

- Build a reliable process for recovering contract-based identities when only
  the seed is provided. Search through the key's transaction history for contract
  creation, then test ABI calls for known authentication mechanisms to see if
  they work. This won't work for recovered seeds that had contract identities
  transferred to them after creation, but it's better than nothing.
