import t from 'tcomb';
import Web3 from 'web3';


export const Hex = t.refinement(
  t.String,
  (hex) => hex.slice(0, 2) === '0x',
  'Hex'
);

export const Address = t.refinement(
  Hex,
  (address) => address.length === 42,
  'Address'
);

export const Identity = t.struct({
  address: Address,
}, 'Identity');

Identity.prototype.getGasAffordability = function (provider) {
  const web3 = new Web3(provider);
  const getBalance = Promise.promisify(web3.eth.getBalance);
  const getGasPrice = Promise.promisify(web3.eth.getGasPrice);
  Promise.all([getBalance(this.key || this.address), getGasPrice()])
    .then(([balance, gasPrice]) => ({balance, gasPrice}));
};
