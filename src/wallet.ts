import { ec } from 'elliptic';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as _ from 'lodash';
import { getPublicKey, getTransactionId, signTxIn, Transaction, TxIn, TxOut, UnspentTxOut } from './transaction'

const EC = new ec('secp256k1');
const privateKeyLocation = 'node/wallet/private_key';

function getPrivateFromWallet(): string {
    const buffer = readFileSync(privateKeyLocation, 'utf8');
    return buffer.toString();
}

function getPublicFromWallet(): string {
  const privateKey = getPrivateFromWallet();
  const key = EC.keyFromPrivate(privateKey, 'hex');
  return key.getPublic().encode('hex');
}

function generatePrivatekey(): string {
    const keyPair = EC.genKeyPair();
    const privateKey = keyPair.getPrivate();
    return privateKey.toString(16);
};

function initWallet() {
    //let's not override existing private keys
    if (existsSync(privateKeyLocation)) {
        return;
    }
    const newPrivateKey = generatePrivatekey();

    writeFileSync(privateKeyLocation, newPrivateKey);
    console.log('new wallet with private key created');
};

function getBalance(address: string, unspentTxOuts: UnspentTxOut[]): number {
  return _(unspentTxOuts)
      .filter((uTxO: UnspentTxOut) => uTxO.address === address)
      .map((uTxO: UnspentTxOut) => uTxO.amount)
      .sum();
};