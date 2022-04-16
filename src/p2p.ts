import * as WebSocket from 'ws';
import {Server} from 'ws';
import {
    addBlockToChain, Block, getBlockchain, getLatestBlock, handleReceivedTransaction, isBlockStructureValid,
    replaceChain
} from './blockchain';
import { Transaction } from './transaction';

enum MessageType {
  QUERY_LATEST = 0,
  QUERY_ALL = 1,
  RESPONSE_BLOCKCHAIN = 2,
  QUERY_TRANSACTION_POOL = 3,
  RESPONSE_TRANSACTION_POOL = 4
}

class Message {
  public type: MessageType;
  public data: any;
}

// const initP2PServer(port: number) {
//   const server: Server = new WebSocket.Server({ port });
// }