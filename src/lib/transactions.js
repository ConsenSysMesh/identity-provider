import BigNumber from 'bignumber.js';
import {promiseCallback} from './callbacks';

import type Web3 from 'web3';
import type {Batcher} from './web3-batch';

// ReceiptConfig is a subset of gnosis.config.Config.
type ReceiptConfig = {
 web3: Web3,
 batcher: Batcher,
 receiptPromises: any,
}

function deconstructedPromise() {
  const parts = {};
  parts.promise = new Promise((resolve, reject) => {
    parts.resolve = resolve;
    parts.reject = reject;
  });
  return parts;
}

function checkForReceipts(filter, config: ReceiptConfig) {
  return () => {
    Object.keys(config.receiptPromises).forEach((hash) => {
      const request = config.web3.eth.getTransactionReceipt.request(hash, (err, receipt) => {
        if (err || receipt == null) {
          return;
        }

        console.log(`Transaction ${hash} was mined in block ${receipt.blockNumber}.`)
        if (config.receiptPromises[hash] != null) {
          config.receiptPromises[hash].resolve(receipt);
          delete config.receiptPromises[hash];
        }
        if (Object.keys(config.receiptPromises).length === 0) {
          filter.stopWatching();
        }
      });
      config.batcher.add(request);
    });
  };
}

/**
 * Create a promise that resolves to the receipt for the given transaction
 * hash once it has been included in a block.
 */
export function waitForReceipt(txhash, config: ReceiptConfig) {
  console.log(`Waiting for transaction ${txhash} to be mined...`);
  if (config.receiptPromises[txhash] != null) {
    return config.receiptPromises[txhash].promise;
  }

  const startWatching = Object.keys(config.receiptPromises).length === 0;

  // Create a promise and store the resolution functions to use when new
  // blocks arrive.
  const promiseParts = deconstructedPromise();
  config.receiptPromises[txhash] = promiseParts;

  if (startWatching) {
    const filter = config.web3.eth.filter('latest');
    filter.watch(checkForReceipts(filter, config));
  }

  return promiseParts.promise;
}

export function isResultZero(result) {
  return result === '0x' || new BigNumber(result, 16).eq(0);
}

export function logOnFailure(logTag, successTest = res => !isResultZero(res)) {
  return (simulatedResult) => {
    if (!successTest(simulatedResult)) {
      console.error(`${logTag}: The simulated result (${simulatedResult}) might indicate an error.`);
    }
    return simulatedResult;
  };
}

export function errorOnFailure(logTag, successTest = res => !isResultZero(res)) {
  return (simulatedResult) => {
    if (!successTest(simulatedResult)) {
      throw new Error(`${logTag}: Simulated transaction result was unsuccessful.`);
    }
    return simulatedResult;
  };
}

export function callAndSendTransaction(contractFunction, args, predictSuccess = logOnFailure('')) {
  return new Promise((resolve, reject) => {
    const callArgs = args.concat(promiseCallback(resolve, reject));
    contractFunction.call.apply(contractFunction, callArgs);
  })
  .then(predictSuccess)
  .then((simulatedResult) => {
    return new Promise((resolve, reject) => {
      const sendArgs = args.concat(promiseCallback(resolve, reject));
      contractFunction.sendTransaction.apply(contractFunction, sendArgs);
    }).then((txhash) => {
      return {txhash: txhash, simulated_result: simulatedResult};
    });
  });
}

export function txDefaults(config) {
  return {
    from: config.account,
    gas: config.defaultGas,
    gasPrice: config.defaultGasPrice,
  };
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
