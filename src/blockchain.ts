import * as CryptoJS from 'crypto-js';
import * as _ from 'lodash';
import { BigNumber } from 'bignumber.js';

import { broadcastLatest, broadCastTransactionPool } from './p2p';
import {
  getCoinbaseTransaction, isAddressValid, processTransactions, Transaction, UnspentTxOut,
} from './transaction';
import { addToTransactionPool, getTransactionPool, updateTransactionPool } from './transactionPool';
import {
  createTransaction, findUnspentTxOuts, getBalance, getPrivateFromWallet, getPublicFromWallet,
} from './wallet';

class Block {
  public index: number;

  public hash: string;

  public previousHash: string;

  public timestamp: number;

  public data: Transaction[];

  public difficulty: number;

  public nonce: number;

  public minterBalance: number;

  public minterAddress: string;

  constructor(
    index: number,
    hash: string,
    previousHash: string,
    timestamp: number,
    data: Transaction[],
    difficulty: number,
    minterBalance: number,
    minterAddress: string,
  ) {
    this.index = index;
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.data = data;
    this.hash = hash;
    this.difficulty = difficulty;
    this.minterBalance = minterBalance;
    this.minterAddress = minterAddress;
  }
}

const genesisTransaction = {
  txIns: [{ signature: '', txOutId: '', txOutIndex: 0 }],
  txOuts: [{
    address: '04bfcab8722991ae774db48f934ca79cfb7dd991229153b9f732ba5334aafcd8e7266e47076996b55a14bf9913ee3145ce0cfc1372ada8ada74bd287450313534a',
    amount: 50,
  }],
  id: 'e655f6a5f26dc9b4cac6e46f52336428287759cf81ef5ff10854f69d68f43fa3',
};

const genesisBlock: Block = new Block(
  0,
  'c94d496b2f86f347722d599fecc91f0823456664a430a24e3cea6f4791562ff5',
  '',
  1650108241,
  [genesisTransaction],
  0,
  0,
  '04bfcab8722991ae774db48f934ca79cfb7dd991229153b9f732ba5334aafcd8e7266e47076996b55a14bf9913ee3145ce0cfc1372ada8ada74bd287450313534a',
);

// For now use a simple array to store the blockchain. This means data will not be persisted if the node goes down.
let blockchain: Block[] = [genesisBlock];

// the unspent txOut of genesis block is set to unspentTxOuts on startup
let unspentTxOuts: UnspentTxOut[] = processTransactions(blockchain[0].data, [], 0);

// Number of blocks that can be minted with accounts without any coins
const mintingWithoutCoinIndex = 100;

const getBlockchain = (): Block[] => blockchain;

const getLatestBlock = (): Block => blockchain[blockchain.length - 1];

const getCurrentTimestamp = (): number => Math.round(new Date().getTime() / 1000);

const getUnspentTxOuts = (): UnspentTxOut[] => _.cloneDeep(unspentTxOuts);

// and txPool should be only updated at the same time
const setUnspentTxOuts = (newUnspentTxOut: UnspentTxOut[]) => {
  unspentTxOuts = newUnspentTxOut;
};

const BLOCK_GENERATION_INTERVAL: number = 10; // Seconds

const DIFFICULTY_ADJUSTMENT_INTERVAL: number = 10; // Blocks

function getDifficulty(aBlockchain: Block[]): number {
  const latestBlock: Block = aBlockchain[aBlockchain.length - 1];

  if (latestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 && latestBlock.index !== 0) {
    return getAdjustedDifficulty(latestBlock, aBlockchain);
  }
  return latestBlock.difficulty;
}

function getAdjustedDifficulty(latestBlock: Block, aBlockchain: Block[]) {
  const prevAdjustmentBlock: Block = aBlockchain[aBlockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
  const timeExpected: number = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
  const timeTaken: number = latestBlock.timestamp = prevAdjustmentBlock.timestamp;

  if (timeTaken < timeExpected / 2) {
    return prevAdjustmentBlock.difficulty + 1;
  } if (timeTaken > timeExpected * 2) {
    return prevAdjustmentBlock.difficulty - 1;
  }
  return prevAdjustmentBlock.difficulty;
}
function calculateHashForBlock(block: Block): string {
  const {
    index, previousHash, timestamp, data, difficulty, minterBalance, minterAddress,
  } = block;
  return calculateHash(index, previousHash, timestamp, data, difficulty, minterBalance, minterAddress);
}

function calculateHash(
  index: number,
  previousHash: string,
  timestamp: number,
  data: Transaction[],
  difficulty: number,
  minterBalance: number,
  minterAddress: string,
): string {
  return CryptoJS.SHA256(index + previousHash + timestamp + data + difficulty + minterBalance + minterAddress).toString();
}

function getMyUnspentTransactionOutputs() {
  return findUnspentTxOuts(getPublicFromWallet(), getUnspentTxOuts());
}

function generateNextBlock() {
  const coinbaseTx: Transaction = getCoinbaseTransaction(getPublicFromWallet(), getLatestBlock().index + 1);
  const blockData: Transaction[] = [coinbaseTx].concat(getTransactionPool());
  return generateRawNextBlock(blockData);
}

function generateNextBlockWithTransaction(receiverAddress: string, amount: number) {
  if (!isAddressValid(receiverAddress)) {
    throw Error('invalid address');
  }
  if (typeof amount !== 'number') {
    throw Error('invalid amount');
  }
  const coinbaseTx: Transaction = getCoinbaseTransaction(getPublicFromWallet(), getLatestBlock().index + 1);
  const tx: Transaction = createTransaction(receiverAddress, amount, getPrivateFromWallet(), getUnspentTxOuts(), getTransactionPool());
  const blockData: Transaction[] = [coinbaseTx, tx];
  return generateRawNextBlock(blockData);
}

function generateRawNextBlock(blockData: Transaction[]) {
  const previousBlock: Block = getLatestBlock();
  const difficulty: number = getDifficulty(getBlockchain());
  const nextIndex: number = previousBlock.index + 1;
  const newBlock: Block = findBlock(nextIndex, previousBlock.hash, blockData, difficulty);
  if (addBlockToChain(newBlock)) {
    broadcastLatest();
    return newBlock;
  }
  return null;
}

// Find a block to try puzzle
function findBlock(index: number, previousHash: string, data: Transaction[], difficulty: number): Block {
  let pastTimestamp: number = 0;

  while (true) {
    const timestamp: number = getCurrentTimestamp();

    if (pastTimestamp !== timestamp) {
      const hash: string = calculateHash(index, previousHash, timestamp, data, difficulty, getAccountBalance(), getPublicFromWallet());

      if (isBlockStakingValid(previousHash, getPublicFromWallet(), timestamp, getAccountBalance(), difficulty, index)) {
        return new Block(index, hash, previousHash, timestamp, data, difficulty, getAccountBalance(), getPublicFromWallet());
      }

      pastTimestamp = timestamp;
    }
  }
}

function replaceChain(newBlocks: Block[]) {
  if (isChainValid(newBlocks) && newBlocks.length > getBlockchain().length) {
    console.log('Received blockchain is valid. Replacing current blockchain with received blockchain');
    blockchain = newBlocks;
    broadcastLatest();
  } else {
    console.log('Received invalid blockchain');
  }
}

function addBlockToChain(newBlock: Block): boolean {
  if (isBlockValid(newBlock, getLatestBlock())) {
    const retVal: UnspentTxOut[] = processTransactions(newBlock.data, getUnspentTxOuts(), newBlock.index);
    if (retVal === null) {
      console.log('block is not valid in terms of transactions');
      return false;
    }
    blockchain.push(newBlock);
    setUnspentTxOuts(retVal);
    updateTransactionPool(unspentTxOuts);
    return true;
  }
  return false;
}

function getAccountBalance(): number {
  return getBalance(getPublicFromWallet(), getUnspentTxOuts());
}

function sendTransaction(address:string, amount: number): Transaction {
  const tx: Transaction = createTransaction(address, amount, getPrivateFromWallet(), getUnspentTxOuts(), getTransactionPool());
  addToTransactionPool(tx, getUnspentTxOuts());
  return tx;
}

/* Validations */

function isTimestampValid(block: Block, previousBlock: Block): boolean {
  return (previousBlock.timestamp - 60 < block.timestamp)
          && block.timestamp - 60 < getCurrentTimestamp();
}

function isBlockValid(block: Block, previousBlock: Block): boolean {
  if (previousBlock.index + 1 !== block.index) {
    console.log('Invalid index');
    return false;
  } if (previousBlock.hash !== block.previousHash) {
    console.log('Invalid previousHash');
    return false;
  } if (calculateHashForBlock(block) !== block.hash) {
    console.log(`Invalid hash: ${calculateHashForBlock(block)} ${block.hash}`);
    return false;
  }

  return true;
}

function isBlockStructureValid(block: Block): boolean {
  return typeof block.index === 'number'
    && typeof block.hash === 'string'
    && typeof block.previousHash === 'string'
    && typeof block.timestamp === 'number'
    && typeof block.data === 'object'
    && typeof block.difficulty === 'number'
    && typeof block.minterBalance === 'number'
    && typeof block.minterAddress === 'string';
}

function isChainValid(chainToValidate: Block[]): boolean {
  const isGenesisValid = (block: Block): boolean => JSON.stringify(block) === JSON.stringify(genesisBlock);

  if (!isGenesisValid(chainToValidate[0])) return false;

  for (let i = 1; i < chainToValidate.length; i++) {
    if (!isBlockValid(chainToValidate[i], chainToValidate[i - 1])) return false;
  }

  return true;
}

function isBlockStakingValid(prevHash: string, address: string, timestamp: number, balance: number, difficulty: number, index: number): boolean {
  difficulty += 1;

  if (index <= mintingWithoutCoinIndex) {
    balance += 1;
  }

  // Proof of stake pizzle from https://blog.ethereum.org/2014/07/05/stake/
  // SHA256(prevhash + address + timestamp) <= 2^256 * balance / difficulty
  const balanceOverDifficulty = new BigNumber(2).exponentiatedBy(256).times(balance).dividedBy(difficulty);
  const stakingHash: string = CryptoJS.SHA256(prevHash + address + timestamp).toString();
  const decimalStakingHash = new BigNumber(stakingHash, 16);
  const difference = balanceOverDifficulty.minus(decimalStakingHash).toNumber();

  return difference >= 0;
}

function handleReceivedTransaction(transaction: Transaction) {
  addToTransactionPool(transaction, getUnspentTxOuts());
}

export {
  Block, getBlockchain, getUnspentTxOuts, getLatestBlock, sendTransaction,
  generateRawNextBlock, generateNextBlock, generateNextBlockWithTransaction,
  handleReceivedTransaction, getMyUnspentTransactionOutputs,
  getAccountBalance, isBlockStructureValid, replaceChain, addBlockToChain,
};
