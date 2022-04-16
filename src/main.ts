import * as express from 'express';
import * as _ from 'lodash';
import {
  Block, generateNextBlock, generateNextBlockWithTransaction, generateRawNextBlock, getAccountBalance,
  getBlockchain, getMyUnspentTransactionOutputs, getUnspentTxOuts, sendTransaction,
} from './blockchain';
import { connectToPeers, getSockets, initP2PServer } from './p2p';
import { UnspentTxOut } from './transaction';
import { getTransactionPool } from './transactionPool';
import { getPublicFromWallet, initWallet } from './wallet';

const httpPort = 3001;
const wsPort = 6001;

function initHttpServer(port: number) {
  const app = express();
  app.use(express.json());

  app.get('/blocks', (req, res) => {
    res.send(getBlockchain());
  });

  app.get('/block/:hash', (req, res) => {
    const block = _.find(getBlockchain(), { hash: req.params.hash });
    res.send(block);
  });

  app.get('/transaction/:id', (req, res) => {
    const tx = _(getBlockchain())
      .map((blocks) => blocks.data)
      .flatten()
      .find({ id: req.params.id });
    res.send(tx);
  });

  app.get('/address/:address', (req, res) => {
    const unspentTxOuts: UnspentTxOut[] = _.filter(getUnspentTxOuts(), (uTxO) => uTxO.address === req.params.address);
    res.send({ unspentTxOuts });
  });

  app.get('/unspentTransactionOutputs', (req, res) => {
    res.send(getUnspentTxOuts());
  });

  app.get('/myUnspentTransactionOutputs', (req, res) => {
    res.send(getMyUnspentTransactionOutputs());
  });

  app.post('/mintRawBlock', (req, res) => {
    if (req.body.data == null) {
      res.send('data parameter is missing');
      return;
    }
    const newBlock: Block = generateRawNextBlock(req.body.data);
    if (newBlock === null) {
      res.status(400).send('could not generate block');
    } else {
      res.send(newBlock);
    }
  });

  app.post('/mintBlock', (req, res) => {
    const newBlock: Block = generateNextBlock();
    if (newBlock === null) {
      res.status(400).send('could not generate block');
    } else {
      res.send(newBlock);
    }
  });

  app.get('/balance', (req, res) => {
    const balance: number = getAccountBalance();
    res.send({ balance });
  });

  app.get('/address', (req, res) => {
    const address: string = getPublicFromWallet();
    res.send({ address });
  });

  app.post('/mintTransaction', (req, res) => {
    const { address } = req.body;
    const { amount } = req.body;
    try {
      const resp = generateNextBlockWithTransaction(address, amount);
      res.send(resp);
    } catch (e) {
      console.log(e.message);
      res.status(400).send(e.message);
    }
  });

  app.post('/sendTransaction', (req, res) => {
    try {
      const { address } = req.body;
      const { amount } = req.body;

      if (address === undefined || amount === undefined) {
        throw Error('invalid address or amount');
      }
      const resp = sendTransaction(address, amount);
      res.send(resp);
    } catch (e) {
      console.log(e.message);
      res.status(400).send(e.message);
    }
  });

  app.get('/transactionPool', (req, res) => {
    res.send(getTransactionPool());
  });

  app.get('/peers', (req, res) => {
    res.send(getSockets().map((s: any) => `${s._socket.remoteAddress}:${s._socket.remotePort}`));
  });
  app.post('/addPeer', (req, res) => {
    connectToPeers(req.body.peer);
    res.send();
  });

  app.post('/stop', (req, res) => {
    res.send({ msg: 'stopping server' });
    process.exit();
  });

  app.listen(port, () => {
    console.log(`Listening http on port: ${port}`);
  });
}

initHttpServer(httpPort);
initP2PServer(wsPort);
initWallet();
