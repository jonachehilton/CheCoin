
import * as CryptoJS from 'crypto-js';
import * as ecdsa from 'elliptic';
import * as _ from 'lodash';

const ec = new ecdsa.ec('secp256k1');

/*
A transaction input must always refer to an unspent transaction output.
Consequently, when you own some coins in the blockchain, 
what you actually have is a list of unspent transaction outputs whose public key matches to the private key you own.
 */
 class UnspentTxOut {
  public readonly txOutId: String;
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





export {
  Transaction, UnspentTxOut, TxIn, TxOut, getTransactionId, signTxIn
};