export function promiseCallback(resolve, reject) {
  return (error, result) => {
    if (error) {
      reject(error);
    } else {
      resolve(result);
    }
  };
}

export function streamCallback(observer) {
  return (error, result) => {
    if (error) {
      observer.onError(error);
    } else {
      observer.onNext(result);
      observer.onCompleted();
    }
  };
}
