identity-provider
=================

`identity-provider` contains a Web3 `Subprovider` for interacting with Ethereum
accounts without keys present, like accounts signed by external device, or
contract identities that are independent from any key. It uses `web3-provider-engine`
to intercept account-related RPC calls. To sign transactions, you pass a Web3 `Provider`
for the `IdentitySubprovider` to use, like Metamask's injected provider. A
`KeystoreSubprovider` that uses `eth-lightwallet` to sign keys is provided. Most
apps will want to start new users with an in-browser keystore that they can
easily migrate their contract identity away from.

Once a transaction key has been funded, `identity-provider` can create a
contract-based identity by deploying `uport-proxy`'s' proxy contract and
maintaining relevant metadata to allow transactions to be sent as that identity.

Example
-------

See `examples/provider.js`.

Future Directions
-----------------

- Add a URLHandlerIdentity that generates and opens a URL that uses
  lightwallet-mobile's URL scheme instead of trying to sign the transaction
  locally. The IdentityProvider just needs to know the addresses that the system's
  URL handlers can sign for to add it to its list of identities.
- Build a reliable process for recovering contract-based identities when only
  the seed is provided. Search through the key's transaction history for contract
  creation, then test ABI calls for known authentication mechanisms to see if
  they work. This won't work for recovered seeds that had contract identities
  transferred to them after creation, but it's better than nothing.
