import { ec } from 'elliptic';
import {
  existsSync, readFileSync, writeFileSync, unlinkSync,
} from 'fs';
import * as _ from 'lodash';
import {
  getPublicKey, getTransactionId, signTxIn, Transaction, TxIn, TxOut, UnspentTxOut,
} from './transaction';

const secp256k1 = new ec('secp256k1');
const privateKeyLocation = 'node/wallet/private_key';

function getPrivateFromWallet(): string {
  const buffer = readFileSync(privateKeyLocation, 'utf8');
  return buffer.toString();
}

function getPublicFromWallet(): string {
  const privateKey = getPrivateFromWallet();
  const key = secp256k1.keyFromPrivate(privateKey, 'hex');
  return key.getPublic().encode('hex');
}

function generatePrivatekey(): string {
  const keyPair = secp256k1.genKeyPair();
  const privateKey = keyPair.getPrivate();
  return privateKey.toString(16);
}

function initWallet() {
  // let's not override existing private keys
  if (existsSync(privateKeyLocation)) {
    return;
  }
  const newPrivateKey = generatePrivatekey();

  writeFileSync(privateKeyLocation, newPrivateKey);
  console.log('new wallet with private key created');
}

function deleteWallet() {
  if (existsSync(privateKeyLocation)) {
    unlinkSync(privateKeyLocation);
  }
}

function getBalance(address: string, unspentTxOuts: UnspentTxOut[]): number {
  return _(unspentTxOuts)
    .filter((uTxO: UnspentTxOut) => uTxO.address === address)
    .map((uTxO: UnspentTxOut) => uTxO.amount)
    .sum();
}

function findUnspentTxOuts(ownerAddress: string, unspentTxOuts: UnspentTxOut[]) {
  return _.filter(unspentTxOuts, (uTxO: UnspentTxOut) => uTxO.address === ownerAddress);
}

function findTxOutsForAmount(amount: number, myUnspentTxOuts: UnspentTxOut[]) {
  let currentAmount = 0;
  const includedUnspentTxOuts = [];
  for (const myUnspentTxOut of myUnspentTxOuts) {
    includedUnspentTxOuts.push(myUnspentTxOut);
    currentAmount += myUnspentTxOut.amount;
    if (currentAmount >= amount) {
      const leftOverAmount = currentAmount - amount;
      return { includedUnspentTxOuts, leftOverAmount };
    }
  }
  throw Error('not enough coins to send transaction');
}

function filterTxPoolTxs(unspentTxOuts: UnspentTxOut[], transactionPool: Transaction[]): UnspentTxOut[] {
  const txIns: TxIn[] = _(transactionPool)
    .map((tx: Transaction) => tx.txIns)
    .flatten()
    .value();
  const removable: UnspentTxOut[] = [];
  for (const unspentTxOut of unspentTxOuts) {
    const txIn = _.find(txIns, (aTxIn: TxIn) => aTxIn.txOutIndex === unspentTxOut.txOutIndex && aTxIn.txOutId === unspentTxOut.txOutId);

    if (!txIn === undefined) {
      removable.push(unspentTxOut);
    }
  }

  return _.without(unspentTxOuts, ...removable);
}

function createTxOuts(receiverAddress:string, myAddress:string, amount, leftOverAmount: number) {
  const txOut1: TxOut = new TxOut(receiverAddress, amount);
  if (leftOverAmount === 0) {
    return [txOut1];
  }
  const leftOverTx = new TxOut(myAddress, leftOverAmount);
  return [txOut1, leftOverTx];
}

function createTransaction(
  receiverAddress: string,
  amount: number,
  privateKey: string,
  unspentTxOuts: UnspentTxOut[],
  txPool: Transaction[],
): Transaction {
  console.log('txPool: %s', JSON.stringify(txPool));
  const myAddress: string = getPublicKey(privateKey);
  const myUnspentTxOutsA = unspentTxOuts.filter((uTxO: UnspentTxOut) => uTxO.address === myAddress);

  const myUnspentTxOuts = filterTxPoolTxs(myUnspentTxOutsA, txPool);

  // filter from unspentOutputs such inputs that are referenced in pool
  const { includedUnspentTxOuts, leftOverAmount } = findTxOutsForAmount(amount, myUnspentTxOuts);

  const toUnsignedTxIn = (unspentTxOut: UnspentTxOut) => {
    const txIn: TxIn = new TxIn();
    txIn.txOutId = unspentTxOut.txOutId;
    txIn.txOutIndex = unspentTxOut.txOutIndex;
    return txIn;
  };

  const unsignedTxIns: TxIn[] = includedUnspentTxOuts.map(toUnsignedTxIn);

  const tx: Transaction = new Transaction();
  tx.txIns = unsignedTxIns;
  tx.txOuts = createTxOuts(receiverAddress, myAddress, amount, leftOverAmount);
  tx.id = getTransactionId(tx);

  tx.txIns = tx.txIns.map((txIn: TxIn, index: number) => {
    txIn.signature = signTxIn(tx, index, privateKey, unspentTxOuts);
    return txIn;
  });

  return tx;
}

export {
  createTransaction, getPublicFromWallet,
  getPrivateFromWallet, getBalance, generatePrivatekey, initWallet, deleteWallet, findUnspentTxOuts,
};
