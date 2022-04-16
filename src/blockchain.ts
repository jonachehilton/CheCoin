import * as CryptoJS from 'crypto-js';

class Block {
  public index: number;

  public hash: string;

  public previousHash: string;

  public timestamp: number;

  public data: string;

  constructor(index: number, hash: string, previousHash: string, timestamp: number, data: string) {
    this.index = index;
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.data = data;
    this.hash = hash;
  }
}

const genesisBlock: Block = new Block(
  0, 
  'c94d496b2f86f347722d599fecc91f0823456664a430a24e3cea6f4791562ff5', 
  null, 
  1650108241,
  'CheCoin Genesis Block'
);

// For now use a simple array to store the blockchain. This means data will not be persisted if the node goes down.
const blockchain: Block[] = [genesisBlock];


function calculateHash(index: number, previousHash: string, timestamp: number, data: string): string {
  return CryptoJS.SHA256(index + previousHash + timestamp + data).toString();
}

function generateNextBlock(blockData: string): Block {
  const previousBlock: Block = getLatestBlock();
  const nextIndex: number = previousBlock.index + 1;
  const nextTimestamp: number = new Date().getTime() / 1000;
  const nextHash: string = calculateHash(nextIndex, previousBlock.hash, nextTimestamp, blockData);

  return new Block(nextIndex, nextHash, previousBlock.hash, nextTimestamp, blockData);
}

function isBlockValid(block: Block, previousBlock: Block): boolean {
  if (previousBlock.index + 1 !== block.index) {
    console.log ('Invalid index');
    return false;
  } else if (previousBlock.hash !== block.previousHash) {
    console.log ('Invalid previousHash');
    return false;
  } else if (calculateHashForBlock(block) !== block.hash) {
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
    && typeof block.data === 'string';
}

function isChainValid(chainToValidate: Block[]): boolean {
  const isGenesisValid = (block: Block): boolean => JSON.stringify(block) === JSON.stringify(genesisBlock);
  
  if (!isGenesisValid(chainToValidate[0])) return false;

  for (let i = 1; i < chainToValidate.length; i++) {
    if (!isBlockValid(chainToValidate[i], chainToValidate[i - 1])) return false;
  }

  return true;
}

