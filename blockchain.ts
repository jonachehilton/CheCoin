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
  0, 'c94d496b2f86f347722d599fecc91f0823456664a430a24e3cea6f4791562ff5', null, 1650108241, 'CheCoin Genesis Block'
);

function calculateHash(index: number, previousHash: string, timestamp: number, data: string): string {
  return CryptoJS.SHA256(index + previousHash + timestamp + data).toString();
}