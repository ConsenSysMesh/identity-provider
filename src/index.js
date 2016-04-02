import * as actions from './actions';
import * as config from './config';
import * as contracts from './contracts';
import * as keystore from './keystore';
import * as provider from './provider';
import * as types from './types';
/*
New identities are AccountIdentities with a freshly generated key. Those
can be upgraded to SenderIdentities by deploying a proxy contract. To support
separate keys on multiple devices or transactions paid for by third parties,
SenderIdentities and be upgraded to a metatransaction OwnerIdentity by deploying
an OwnerWithMetaTx contract and transferring ownership to it.


Deploy owned proxy contract, which sets the owner to the sender
Deploy owner contract
Set the proxy owner to the owner contract
Initialize
Backup
Set balance

 */

export default {actions, config, contracts, keystore, provider, types};
