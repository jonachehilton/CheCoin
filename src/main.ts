import * as express from 'express';
import {
  Block, getBlockchain, generateNextBlock,
} from './blockchain';

const httpPort = 3001;

function initHttpServer(port: number) {
  const app = express();
  app.use(express.json());
  
  app.get('/blocks', (req, res) => {
    res.send(getBlockchain());
  });

  app.post('/mintBlock', (req, res) => {
      const newBlock: Block = generateNextBlock(req.body.data);
      res.send(newBlock);
  });

  app.post('mintTransaction', (req, res) => {
    const address = req.body.address;
    const amount = req.body.amount;
    const resp = generateNextBlockWithTransaction(address, amount);
    res.send(resp);
  })

  
  // app.get('/peers', (req, res) => {
  //     res.send(getSockets().map(( s: any ) => s._socket.remoteAddress + ':' + s._socket.remotePort));
  // });

  // app.post('/addPeer', (req, res) => {
  //     connectToPeers(req.body.peer);
  //     res.send();
  // });

  app.listen(port, () => {
      console.log('Listening http on port: ' + port);
  });

  initHttpServer(httpPort);
}