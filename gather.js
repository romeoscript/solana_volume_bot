"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.solanaConnection = void 0;
const bs58_1 = __importDefault(require("bs58"));
const utils_1 = require("./utils");
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const raydium_sdk_1 = require("@raydium-io/raydium-sdk");
const swapOnlyAmm_1 = require("./utils/swapOnlyAmm");
const legacy_1 = require("./executor/legacy");
const constants_1 = require("./constants");
exports.solanaConnection = new web3_js_1.Connection(constants_1.RPC_ENDPOINT, {
    wsEndpoint: constants_1.RPC_WEBSOCKET_ENDPOINT, commitment: "processed"
});
const rpcUrl = (0, utils_1.retrieveEnvVariable)("RPC_ENDPOINT", utils_1.logger);
const mainKpStr = (0, utils_1.retrieveEnvVariable)('PRIVATE_KEY', utils_1.logger);
const connection = new web3_js_1.Connection(rpcUrl, { commitment: "processed" });
const mainKp = web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode(mainKpStr));
const main = async () => {
    const walletsData = utils_1.readJson();
    const wallets = walletsData.map(({ privateKey }) => web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode(privateKey)));
    const mainPubkey = mainKp.publicKey;

    for (const wallet of wallets) {
        try {
            const balance = await connection.getBalance(wallet.publicKey);
            if (balance > 5000) { // leave a little for fees
                const tx = new web3_js_1.Transaction().add(
                    web3_js_1.SystemProgram.transfer({
                        fromPubkey: wallet.publicKey,
                        toPubkey: mainPubkey,
                        lamports: balance - 5000
                    })
                );
                tx.feePayer = wallet.publicKey;
                tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                const sig = await web3_js_1.sendAndConfirmTransaction(connection, tx, [wallet]);
                console.log(`Recovered ${(balance / 1e9).toFixed(6)} SOL from ${wallet.publicKey.toBase58()} in tx: https://solscan.io/tx/${sig}`);
            } else {
                console.log(`Wallet ${wallet.publicKey.toBase58()} has too little SOL (${balance} lamports)`);
            }
        } catch (err) {
            console.log(`Error recovering from ${wallet.publicKey.toBase58()}:`, err);
        }
    }
};
main();
