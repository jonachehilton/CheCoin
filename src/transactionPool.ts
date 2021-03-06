import * as _ from 'lodash';
import {
  Transaction, TxIn, UnspentTxOut, validateTransaction,
} from './transaction';

let transactionPool: Transaction[] = [];

const getTransactionPool = () => _.cloneDeep(transactionPool);

const getTxPoolIns = (aTransactionPool: Transaction[]): TxIn[] => _(aTransactionPool)
  .map((tx) => tx.txIns)
  .flatten()
  .value();

const isValidTxForPool = (tx: Transaction, aTtransactionPool: Transaction[]): boolean => {
  const txPoolIns: TxIn[] = getTxPoolIns(aTtransactionPool);

  const containsTxIn = (txIns: TxIn[], txIn: TxIn) => _.find(txPoolIns, ((txPoolIn) => txIn.txOutIndex === txPoolIn.txOutIndex && txIn.txOutId === txPoolIn.txOutId));

  for (const txIn of tx.txIns) {
    if (containsTxIn(txPoolIns, txIn)) {
      console.log('txIn already found in the txPool');
      return false;
    }
  }
  return true;
};

const addToTransactionPool = (tx: Transaction, unspentTxOuts: UnspentTxOut[]) => {
  if (!validateTransaction(tx, unspentTxOuts)) {
    throw Error('Trying to add invalid tx to pool');
  }

  if (!isValidTxForPool(tx, transactionPool)) {
    throw Error('Trying to add invalid tx to pool');
  }
  console.log('adding to txPool: %s', JSON.stringify(tx));
  transactionPool.push(tx);
};

const hasTxIn = (txIn: TxIn, unspentTxOuts: UnspentTxOut[]): boolean => {
  const foundTxIn = unspentTxOuts.find((uTxO: UnspentTxOut) => uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex);
  return foundTxIn !== undefined;
};

const updateTransactionPool = (unspentTxOuts: UnspentTxOut[]) => {
  const invalidTxs = [];
  for (const tx of transactionPool) {
    for (const txIn of tx.txIns) {
      if (!hasTxIn(txIn, unspentTxOuts)) {
        invalidTxs.push(tx);
        break;
      }
    }
  }
  if (invalidTxs.length > 0) {
    console.log('removing the following transactions from txPool: %s', JSON.stringify(invalidTxs));
    transactionPool = _.without(transactionPool, ...invalidTxs);
  }
};

export { addToTransactionPool, getTransactionPool, updateTransactionPool };
