
import * as CryptoJS from 'crypto-js';
import * as ecdsa from 'elliptic';
import * as _ from 'lodash';

const ec = new ecdsa.ec('secp256k1');

// First 50 coins added to circulation
const COINBASE_AMOUNT: number = 50;

/*
A transaction input must always refer to an unspent transaction output.
Consequently, when you own some coins in the blockchain, 
what you actually have is a list of unspent transaction outputs whose public key matches to the private key you own.
 */
 class UnspentTxOut {
  public readonly txOutId: string;
  public readonly txOutIndex: number;
  public readonly address: string;
  public readonly amount: number;

  constructor(txOutId: string, txOutIndex: number, address: string, amount: number) {
    this.txOutId = txOutId;
    this.txOutIndex = txOutIndex;
    this.address = address;
    this.amount = amount;
  }
}

/*
Transaction inputs provide the information "where" the coins are going to be sent.
 */
class TxOut {
  public address: string; // ECDSA public-key
  public amount: number;

  constructor(address: string, amount: number) {
    this.address = address;
    this.amount = amount;
  }
}

/*
Transaction inputs provide the information "where" the coins are coming from.
*/
class TxIn {
  public txOutId: string;
  public txOutIndex: number;
  public signature: string;
}

class Transaction {
  public id: string;
  public txIns: TxIn[];
  public txOuts: TxOut[];
}

// Calculate hash from the contents of transaction, except for the signature.
function getTransactionId(transaction: Transaction): string {
  const txInContent: string = transaction.txIns
    .map((txIn: TxIn) => txIn.txOutId + txIn.txOutIndex)
    .reduce((a, b) => a + b, '');

    const txOutContent: string = transaction.txOuts
      .map((txOut: TxOut) => txOut.address + txOut.amount)
      .reduce((a, b) => a + b, '');

  return CryptoJS.SHA256(txInContent + txOutContent).toString();
}

const toHexString = (byteArray): string => {
  return Array.from(byteArray, (byte: any) => {
      return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('');
};

const getTxInAmount = (txIn: TxIn, aUnspentTxOuts: UnspentTxOut[]): number => {
  return findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, aUnspentTxOuts).amount;
};

const findUnspentTxOut = (transactionId: string, index: number, aUnspentTxOuts: UnspentTxOut[]): UnspentTxOut => {
  return aUnspentTxOuts.find((uTxO) => uTxO.txOutId === transactionId && uTxO.txOutIndex === index);
};

function signTxIn(transaction: Transaction, txInIndex: number,
   privateKey: string, aUnspentTxOuts: UnspentTxOut[]): string {
  const txIn: TxIn = transaction.txIns[txInIndex];
  const dataToSign = transaction.id;
  const referencedUnspentTxOut: UnspentTxOut = findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, aUnspentTxOuts)
  const referencedAddress: string = referencedUnspentTxOut.address;
  const key = ec.keyFromPrivate(privateKey, 'hex');
  const signature: string = toHexString(key.sign(dataToSign).toDER());

  return signature
}

const updateUnspentTxOuts = (aTransactions: Transaction[], aUnspentTxOuts: UnspentTxOut[]): UnspentTxOut[] => {
  const newUnspentTxOuts: UnspentTxOut[] = aTransactions
      .map((t) => {
          return t.txOuts.map((txOut, index) => new UnspentTxOut(t.id, index, txOut.address, txOut.amount));
      })
      .reduce((a, b) => a.concat(b), []);

  const consumedTxOuts: UnspentTxOut[] = aTransactions
      .map((t) => t.txIns)
      .reduce((a, b) => a.concat(b), [])
      .map((txIn) => new UnspentTxOut(txIn.txOutId, txIn.txOutIndex, '', 0));

  const resultingUnspentTxOuts = aUnspentTxOuts
      .filter(((uTxO) => !findUnspentTxOut(uTxO.txOutId, uTxO.txOutIndex, consumedTxOuts)))
      .concat(newUnspentTxOuts);

  return resultingUnspentTxOuts;
};


/* Validations */

function isTxInStructureValid(txIn: TxIn): boolean {
  if (txIn == null) {
      console.log('txIn is null');
      return false;
  } else if (typeof txIn.signature !== 'string') {
      console.log('invalid signature type in txIn');
      return false;
  } else if (typeof txIn.txOutId !== 'string') {
      console.log('invalid txOutId type in txIn');
      return false;
  } else if (typeof  txIn.txOutIndex !== 'number') {
      console.log('invalid txOutIndex type in txIn');
      return false;
  } else {
      return true;
  }
};

function isTxOutStructureValid(txOut: TxOut): boolean {
  if (txOut == null) {
      console.log('txOut is null');
      return false;
  } else if (typeof txOut.address !== 'string') {
      console.log('invalid address type in txOut');
      return false;
  } else if (!isAddressValid(txOut.address)) {
      console.log('invalid TxOut address');
      return false;
  } else if (typeof txOut.amount !== 'number') {
      console.log('invalid amount type in txOut');
      return false;
  } else {
      return true;
  }
};

function isTransactionStructureValid(transaction: Transaction): boolean {
  if (typeof transaction.id !== 'string') {
    console.log('transactionId missing');
    return false;
}
  if (!(transaction.txIns instanceof Array)) {
      console.log('invalid txIns type in transaction');
      return false;
  }
  if (!transaction.txIns
          .map(isTxInStructureValid)
          .reduce((a, b) => (a && b), true)) {
      return false;
  }

  if (!(transaction.txOuts instanceof Array)) {
      console.log('invalid txIns type in transaction');
      return false;
  }

  if (!transaction.txOuts
          .map(isTxOutStructureValid)
          .reduce((a, b) => (a && b), true)) {
      return false;
  }
  return true;
}

function isAddressValid (address: string): boolean {
  if (address.length !== 130) {
      console.log(address);
      console.log('invalid public key length');
      return false;
  } else if (address.match('^[a-fA-F0-9]+$') === null) {
      console.log('public key must contain only hex characters');
      return false;
  } else if (!address.startsWith('04')) {
      console.log('public key must start with 04');
      return false;
  }
  return true;
};

function validateTransaction(transaction: Transaction, aUnspentTxOuts: UnspentTxOut[]): boolean {

  if (!isTransactionStructureValid(transaction)) {
      return false;
  }

  if (getTransactionId(transaction) !== transaction.id) {
      console.log('invalid tx id: ' + transaction.id);
      return false;
  }
  const hasValidTxIns: boolean = transaction.txIns
      .map((txIn) => validateTxIn(txIn, transaction, aUnspentTxOuts))
      .reduce((a, b) => a && b, true);

  if (!hasValidTxIns) {
      console.log('some of the txIns are invalid in tx: ' + transaction.id);
      return false;
  }

  const totalTxInValues: number = transaction.txIns
      .map((txIn) => getTxInAmount(txIn, aUnspentTxOuts))
      .reduce((a, b) => (a + b), 0);

  const totalTxOutValues: number = transaction.txOuts
      .map((txOut) => txOut.amount)
      .reduce((a, b) => (a + b), 0);

  if (totalTxOutValues !== totalTxInValues) {
      console.log('totalTxOutValues !== totalTxInValues in tx: ' + transaction.id);
      return false;
  }

  return true;
};

function validateCoinbaseTx(transaction: Transaction, blockIndex: number): boolean {
  if (getTransactionId(transaction) !== transaction.id) {
    console.log('invalid coinbase tx id: ' + transaction.id);
    return false;
  }
  if (transaction.txIns.length !== 1) {
      console.log('one txIn must be specified in the coinbase transaction');
      return;
  }
  if (transaction.txIns[0].txOutIndex !== blockIndex) {
      console.log('the txIn index in coinbase tx must be the block height');
      return false;
  }
  if (transaction.txOuts.length !== 1) {
      console.log('invalid number of txOuts in coinbase transaction');
      return false;
  }
  if (transaction.txOuts[0].amount != COINBASE_AMOUNT) {
      console.log('invalid coinbase amount in coinbase transaction');
      return false;
  }
  return true;
}

function validateTxIn(txIn: TxIn, transaction: Transaction, aUnspentTxOuts: UnspentTxOut[]): boolean {
  const referencedUTxOut: UnspentTxOut =
      aUnspentTxOuts.find((uTxO) => uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex);
  if (referencedUTxOut == null) {
      console.log('referenced txOut not found: ' + JSON.stringify(txIn));
      return false;
  }
  const address = referencedUTxOut.address;

  const key = ec.keyFromPublic(address, 'hex');
  const validSignature: boolean = key.verify(transaction.id, txIn.signature);
  if (!validSignature) {
      console.log('invalid txIn signature: %s txId: %s address: %s', txIn.signature, transaction.id, referencedUTxOut.address);
      return false;
  }
  return true;
};




export {
  Transaction, UnspentTxOut, TxIn, TxOut, getTransactionId, signTxIn
};