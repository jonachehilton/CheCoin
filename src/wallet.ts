import { ec } from 'elliptic';
import { existsSync, writeFileSync } from 'fs';

const EC = new ec('secp256k1');
const privateKeyLocation = 'node/wallet/private_key';

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