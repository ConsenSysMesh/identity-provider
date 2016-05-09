import BigNumber from 'bignumber.js';
import Promise from 'bluebird';
import t from 'tcomb';
import Web3 from 'web3';


/**
 * A transaction-dependent computation. Clients can compose operations on the
 * result of the transaction, but can always simulate the transaction to
 * check the gas costs or return value of the dependent transaction.
 *
 * This approach is intended for libraries that want to provide clients with
 * promises that resolve to a useful value.
 */
export const Transaction = t.struct({
  options: t.Object,
  expectedGas: t.maybe(t.Number),
  // handleTransact is typically passed via compose unless the transaction
  // logic itself is being overridden.
  handleTransact: t.maybe(t.Function),
});

Object.assign(Transaction.prototype, {
  /**
   * Performs the transaction-dependent computation defined in handleTransact. If
   * handleTransact was not provided, the transaction is sent and its hash is
   * returned in a Promise.
   */
  transact(provider, overrides) {
    if (this.handleTransact != null) {
      return this.handleTransact(provider, overrides);
    }

    const web3 = new Web3(provider);
    const sendTransaction = Promise.promisify(web3.eth.sendTransaction);
    return sendTransaction({ ...this.options, ...(overrides || {}) });
  },

  /**
   * Create a new Transaction that operates on this Transaction's result using
   * the provided function. Its transact() method will return a Promise that
   * resolves to the result of the provided function.
   *
   * The provided function will receive the Web3 Provider used for the transaction
   * as the last argument.
   */
  map(fn) {
    const wrapped = this;
    return Transaction({
      ...wrapped,
      handleTransact(provider, overrides) {
        return wrapped.transact(provider, overrides)
          .then((...args) => fn(...args, provider));
      },
    });
  },

  estimateGas(provider) {
    const web3 = new Web3(provider);
    const web3EstimateGas = Promise.promisify(web3.eth.estimateGas);
    return web3EstimateGas(this.options);
  },

  getQuickestGasEstimate(provider) {
    if (this.expectedGas != null) {
      return Promise.resolve(this.expectedGas);
    }
    return this.estimateGas(provider);
  },
});

function deconstructedPromise() {
  const parts = {};
  parts.promise = new Promise((resolve, reject) => {
    parts.resolve = resolve;
    parts.reject = reject;
  });
  return parts;
}

function receiptChecker(hash, filter, web3Provider, resolve) {
  return () => {
    new Web3(web3Provider).eth.getTransactionReceipt(hash, (err, receipt) => {
      if (err || receipt == null) {
        return;
      }

      console.log(`Transaction ${hash} was mined in block ${receipt.blockNumber}.`);
      resolve(receipt);
      filter.stopWatching();
    });
  };
}

/**
 * Create a promise that resolves to the receipt for the given transaction
 * hash once it has been included in a block.
 */
export function waitForReceipt(txhash, web3Provider) {
  console.log(`Waiting for transaction ${txhash} to be mined...`);
  const {promise, resolve} = deconstructedPromise();
  // Start a block filter to check for receipts on each new block.
  const filter = new Web3(web3Provider).eth.filter('latest');
  const checkForReceipt = receiptChecker(txhash, filter, web3Provider, resolve);
  filter.watch(checkForReceipt);

  // Check for a receipt on the current block. The transaction might have been
  // mined before the filter was created.
  checkForReceipt();

  return promise;
}

export function waitForContract(Contract, txhash, web3Provider) {
  const getCode = Promise.promisify(new Web3(web3Provider).eth.getCode);
  return waitForReceipt(txhash, web3Provider)
    .then((receipt) => {
      // Contract addresses are deterministic, so web3 (supposedly) sets the
      // contract address on the receipt even if the transaction failed. Checking
      // for the contract code proves the transaction succeeded.
      return getCode(receipt.contractAddress)
        .then((code) => {
          if (code.length > 2) {
            return receipt;
          }

          throw new Error('Contract code was not stored, probably because it ran out of gas.');
        });
    })
    .then(receipt => Contract.at(receipt.contractAddress));
}

/**
 * Generate a callback and promises for each step of the contract creation process.
 *
 * web3's Contract.new takes a callback that is called twice. It's called with
 * the transaction hash first, then is called with the new contract address
 * when it's available.
 *
 * NOTE: web3's Contract.new() makes it possible for onContractAddress to never
 * get called, especially against TestRPC. You probably want to use onTxHash and
 * waitForReceipt instead of relying on onContractAddress.
 */
export function newContractHooks() {
  const onTxHash = deconstructedPromise();
  const onContractAddress = deconstructedPromise();
  let callbackCallCount = 0;
  const callback = (err, value) => {
    const currentEvent = callbackCallCount === 0 ? onTxHash : onContractAddress;
    if (err) {
      currentEvent.reject(err);
    } else {
      currentEvent.resolve(value);
    }
    callbackCallCount++;
  };

  return {
    onTxHash: onTxHash.promise,
    onContractAddress: onContractAddress.promise,
    callback,
  };
}
