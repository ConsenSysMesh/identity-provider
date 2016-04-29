import BigNumber from 'bignumber.js';
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
  transact(provider) {
    if (this.handleTransact != null) {
      return this.handleTransact(provider);
    }

    const web3 = new Web3(provider);
    const sendTransaction = Promise.promisify(web3.eth.sendTransaction);
    return sendTransaction(this.options);
  },

  /**
   * Create a new Transaction that operates on this Transaction's result using
   * the provided function. Its transact() method will return a Promise that
   * resolves to the result of the provided function.
   */
  map(fn) {
    const self = this;
    return Transaction({
      ...self,
      handleTransact(provider) {
        return self.transact(provider).then(fn);
      },
    });
  },

  estimateGas(provider) {
    const web3 = new Web3(provider);
    const estimateGas = Promise.promisify(web3.eth.estimateGas);
    return estimateGas(this.options);
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
  const filter = new Web3(web3Provider).eth.filter('latest');
  filter.watch(receiptChecker(txhash, filter, web3Provider, resolve));
  return promise;
}

/**
 * Generate a callback and promises for each step of the contract creation process.
 *
 * web3's Contract.new takes a callback that is called twice. It's called with
 * the transaction hash first, then is called with the new contract address
 * when it's available.
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
