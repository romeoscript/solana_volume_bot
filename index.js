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
exports.mainKp = exports.solanaConnection = void 0;
const spl_token_1 = require("@solana/spl-token");
const web3_js_1 = require("@solana/web3.js");
const constants_1 = require("./constants");
const utils_1 = require("./utils");
const bs58_1 = __importDefault(require("bs58"));
const swapOnlyAmm_1 = require("./utils/swapOnlyAmm");
const legacy_1 = require("./executor/legacy");
const jito_1 = require("./executor/jito");
const fs = require('fs');
function logProgress(message) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync('progress.log', `[${timestamp}] ${message}\n`);
  console.log(message);
}
exports.solanaConnection = new web3_js_1.Connection(constants_1.RPC_ENDPOINT, {
    wsEndpoint: constants_1.RPC_WEBSOCKET_ENDPOINT, commitment: "confirmed"
});
exports.mainKp = web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode(constants_1.PRIVATE_KEY));
const baseMint = new web3_js_1.PublicKey(constants_1.TOKEN_MINT);
const distritbutionNum = constants_1.DISTRIBUTE_WALLET_NUM > 20 ? 20 : constants_1.DISTRIBUTE_WALLET_NUM;
const jitoCommitment = "confirmed";
const main = () => __awaiter(void 0, void 0, void 0, function* () {
    const solBalance = yield exports.solanaConnection.getBalance(exports.mainKp.publicKey);
    logProgress(`Volume bot is running`);
    logProgress(`Wallet address: ${exports.mainKp.publicKey.toBase58()}`);
    logProgress(`Pool token mint: ${baseMint.toBase58()}`);
    logProgress(`Wallet SOL balance: ${(solBalance / web3_js_1.LAMPORTS_PER_SOL).toFixed(3)}SOL`);
    logProgress(`Buying wait time max: ${constants_1.BUY_INTERVAL_MAX}s`);
    logProgress(`Buying wait time min: ${constants_1.BUY_INTERVAL_MIN}s`);
    logProgress(`Selling wait time max: ${constants_1.SELL_INTERVAL_MAX}s`);
    logProgress(`Selling wait time min: ${constants_1.SELL_INTERVAL_MIN}s`);
    logProgress(`Buy upper limit percent: ${constants_1.BUY_UPPER_PERCENT}%`);
    logProgress(`Buy lower limit percent: ${constants_1.BUY_LOWER_PERCENT}%`);
    logProgress(`Distribute SOL to ${distritbutionNum} wallets`);
    let data = null;
    if (solBalance < (constants_1.BUY_LOWER_PERCENT + 0.002) * distritbutionNum) {
        logProgress("Sol balance is not enough for distribution");
    }
    data = yield distributeSol(exports.solanaConnection, exports.mainKp, distritbutionNum);
    if (data == null || data.length == 0) {
        logProgress("Distribution failed");
        return;
    }
    data.map((_a, i_1) => __awaiter(void 0, [_a, i_1], void 0, function* ({ kp }, i) {
        yield (0, utils_1.sleep)(i * 5000);
        let srcKp = kp;
        while (true) {
            const BUY_WAIT_INTERVAL = Math.round(Math.random() * (constants_1.BUY_INTERVAL_MAX - constants_1.BUY_INTERVAL_MIN) + constants_1.BUY_INTERVAL_MIN);
            const SELL_WAIT_INTERVAL = Math.round(Math.random() * (constants_1.SELL_INTERVAL_MAX - constants_1.SELL_INTERVAL_MIN) + constants_1.SELL_INTERVAL_MIN);
            let buyAmount = Math.floor(Math.random() * (130_000_000 - 50_000_000 + 1) + 50_000_000);
            logProgress(`Using buy amount: ${(buyAmount / 1e9).toFixed(6)} SOL (${buyAmount} lamports)`);
            let i = 0;
            while (true) {
                try {
                    const walletBalance = yield exports.solanaConnection.getBalance(srcKp.publicKey);
                    logProgress(`Starting buy loop for wallet ${srcKp.publicKey.toBase58()} with balance ${(walletBalance / 1e9).toFixed(6)} SOL`);
                    if (i > 10) {
                        console.log("Error in buy transaction: Reached max retries");
                        return;
                    }
                    // Use almost all of the wallet's balance for the buy, leave some for fees
                    let buyAmount = walletBalance - 10000; // leave 10000 lamports for fees
                    logProgress(`Using buy amount: ${(buyAmount / 1e9).toFixed(6)} SOL (${buyAmount} lamports)`);
                    const result = yield buy(srcKp, baseMint, buyAmount);
                    if (result) {
                        break;
                    }
                    else {
                        i++;
                        yield (0, utils_1.sleep)(2000);
                    }
                }
                catch (error) {
                    if (error.message && error.message.includes('block height exceeded')) {
                        console.log('Blockheight exceeded, waiting 60 seconds before retry...');
                        await (0, utils_1.sleep)(60000);
                    }
                    console.log("Error in buy() function:", error);
                    i++;
                }
            }
            yield (0, utils_1.sleep)(BUY_WAIT_INTERVAL * 1000);
            let j = 0;
            while (true) {
                if (j > 10) {
                    console.log("Error in sell transaction");
                    return;
                }
                const result = yield sell(baseMint, srcKp);
                if (result) {
                    break;
                }
                else {
                    j++;
                    yield (0, utils_1.sleep)(2000);
                }
            }
            yield (0, utils_1.sleep)(SELL_WAIT_INTERVAL * 1000);
            const balance = yield exports.solanaConnection.getBalance(srcKp.publicKey);
            if (balance < 5 * 10 ** 6) {
                console.log("Sub wallet balance is not enough to continue volume swap");
                return;
            }
            let k = 0;
            while (true) {
                try {
                    if (k > 5) {
                        console.log("Failed to transfer SOL to new wallet in one of sub wallet");
                        return;
                    }
                    const destinationKp = web3_js_1.Keypair.generate();
                    const baseAta = (0, spl_token_1.getAssociatedTokenAddressSync)(baseMint, srcKp.publicKey);
                    (0, utils_1.saveDataToFile)([{
                            privateKey: bs58_1.default.encode(destinationKp.secretKey),
                            pubkey: destinationKp.publicKey.toBase58(),
                        }]);
                    const tx = new web3_js_1.Transaction().add(web3_js_1.ComputeBudgetProgram.setComputeUnitLimit({ units: 600000 }), web3_js_1.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 20000 }), (0, spl_token_1.createCloseAccountInstruction)(baseAta, srcKp.publicKey, srcKp.publicKey), web3_js_1.SystemProgram.transfer({
                        fromPubkey: srcKp.publicKey,
                        toPubkey: destinationKp.publicKey,
                        lamports: balance - 17000 + 2039280
                    }));
                    tx.feePayer = srcKp.publicKey;
                    tx.recentBlockhash = (yield exports.solanaConnection.getLatestBlockhash()).blockhash;
                    const sig = yield (0, web3_js_1.sendAndConfirmTransaction)(exports.solanaConnection, tx, [srcKp], { skipPreflight: true, commitment: "finalized" });
                    srcKp = destinationKp;
                    logProgress(`Transferred SOL to new wallet after buy and sell, https://solscan.io/tx/${sig}`);
                    break;
                }
                catch (error) {
                    k++;
                }
            }
        }
    }));
});
const distributeSol = (connection, mainKp, distritbutionNum) => __awaiter(void 0, void 0, void 0, function* () {
    const data = [];
    const wallets = [];
    try {
        const sendSolTx = [];
        sendSolTx.push(web3_js_1.ComputeBudgetProgram.setComputeUnitLimit({ units: 100000 }), web3_js_1.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 250000 }));
        const mainSolBal = yield connection.getBalance(mainKp.publicKey);
        logProgress(`Main wallet balance: ${(mainSolBal / 1e9).toFixed(6)} SOL`);
        
        if (mainSolBal <= 4 * 10 ** 6) {
            logProgress("Main wallet balance is not enough (less than 0.004 SOL)");
            return [];
        }
        
        // Calculate total required SOL for distribution
        const maxSolPerWallet = 130_000_000; // 0.13 SOL
        const totalRequired = maxSolPerWallet * distritbutionNum;
        logProgress(`Total SOL required for distribution: ${(totalRequired / 1e9).toFixed(6)} SOL`);
        
        if (mainSolBal < totalRequired) {
            logProgress(`Insufficient balance. Have: ${(mainSolBal / 1e9).toFixed(6)} SOL, Need: ${(totalRequired / 1e9).toFixed(6)} SOL`);
            return [];
        }
        
        for (let i = 0; i < distritbutionNum; i++) {
            // Random amount between 0.05 and 0.13 SOL (in lamports)
            let solAmount = Math.floor(Math.random() * (130_000_000 - 50_000_000 + 1) + 50_000_000);
            logProgress(`Funding wallet ${i + 1} with ${(solAmount / 1e9).toFixed(6)} SOL`);
            const wallet = web3_js_1.Keypair.generate();
            wallets.push({ kp: wallet, buyAmount: solAmount });
            sendSolTx.push(web3_js_1.SystemProgram.transfer({
                fromPubkey: mainKp.publicKey,
                toPubkey: wallet.publicKey,
                lamports: solAmount
            }));
            // Save the amount for later use in the buy
            data.push({
                privateKey: bs58_1.default.encode(wallet.kp.secretKey),
                pubkey: wallet.kp.publicKey.toBase58(),
                buyAmount: solAmount
            });
        }
        try {
            (0, utils_1.saveDataToFile)(data);
        }
        catch (error) {
            logProgress(`Error saving wallet data: ${error.message}`);
        }
        let index = 0;
        while (true) {
            try {
                if (index > 5) {
                    logProgress("Distribution failed after 5 retries");
                    return null;
                }
                const siTx = new web3_js_1.Transaction().add(...sendSolTx);
                const latestBlockhash = yield exports.solanaConnection.getLatestBlockhash();
                siTx.feePayer = mainKp.publicKey;
                siTx.recentBlockhash = latestBlockhash.blockhash;
                const messageV0 = new web3_js_1.TransactionMessage({
                    payerKey: mainKp.publicKey,
                    recentBlockhash: latestBlockhash.blockhash,
                    instructions: sendSolTx,
                }).compileToV0Message();
                const transaction = new web3_js_1.VersionedTransaction(messageV0);
                transaction.sign([mainKp]);
                let txSig;
                if (constants_1.JITO_MODE) {
                    txSig = yield (0, jito_1.executeJitoTx)([transaction], mainKp, jitoCommitment);
                }
                else {
                    txSig = yield (0, legacy_1.execute)(transaction, latestBlockhash, 1);
                }
                if (txSig) {
                    const distibuteTx = txSig ? `https://solscan.io/tx/${txSig}` : '';
                    logProgress("SOL distributed " + distibuteTx);
                    break;
                }
                index++;
                logProgress(`Distribution attempt ${index} failed, retrying...`);
            }
            catch (error) {
                index++;
                logProgress(`Distribution error on attempt ${index}: ${error.message}`);
            }
        }
        logProgress("Success in distribution");
        return wallets;
    }
    catch (error) {
        logProgress(`Failed to transfer SOL: ${error.message}`);
        return null;
    }
});
const buy = (newWallet, baseMint, buyAmount) => __awaiter(void 0, void 0, void 0, function* () {
    let solBalance = 0;
    try {
        solBalance = yield exports.solanaConnection.getBalance(newWallet.publicKey);
    }
    catch (error) {
        console.log("Error getting balance of wallet");
        return null;
    }
    if (solBalance == 0) {
        return null;
    }
    try {
        let buyTx = yield (0, swapOnlyAmm_1.getBuyTxWithJupiter)(newWallet, baseMint, buyAmount);
        if (buyTx == null) {
            console.log(`Error getting buy transaction`);
            return null;
        }
        let txSig;
        if (constants_1.JITO_MODE) {
            txSig = yield (0, jito_1.executeJitoTx)([buyTx], exports.mainKp, jitoCommitment);
        }
        else {
            const latestBlockhash = yield exports.solanaConnection.getLatestBlockhash();
            txSig = yield (0, legacy_1.execute)(buyTx, latestBlockhash, 1);
        }
        if (txSig) {
            const tokenBuyTx = txSig ? `https://solscan.io/tx/${txSig}` : '';
            console.log("Success in buy transaction: ", tokenBuyTx);
            return tokenBuyTx;
        }
        else {
            return null;
        }
    }
    catch (error) {
        console.log("Error in buy() function:", error);
        return null;
    }
});
const sell = (baseMint, wallet) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = (0, utils_1.readJson)();
        if (data.length == 0) {
            yield (0, utils_1.sleep)(1000);
            return null;
        }
        const tokenAta = yield (0, spl_token_1.getAssociatedTokenAddress)(baseMint, wallet.publicKey);
        const tokenBalInfo = yield exports.solanaConnection.getTokenAccountBalance(tokenAta);
        if (!tokenBalInfo) {
            console.log("Balance incorrect");
            return null;
        }
        const tokenBalance = tokenBalInfo.value.amount;
        try {
            let sellTx = yield (0, swapOnlyAmm_1.getSellTxWithJupiter)(wallet, baseMint, tokenBalance);
            if (sellTx == null) {
                console.log(`Error getting buy transaction`);
                return null;
            }
            let txSig;
            if (constants_1.JITO_MODE) {
                txSig = yield (0, jito_1.executeJitoTx)([sellTx], exports.mainKp, jitoCommitment);
            }
            else {
                const latestBlockhash = yield exports.solanaConnection.getLatestBlockhash();
                txSig = yield (0, legacy_1.execute)(sellTx, latestBlockhash, 1);
            }
            if (txSig) {
                const tokenSellTx = txSig ? `https://solscan.io/tx/${txSig}` : '';
                console.log("Success in sell transaction: ", tokenSellTx);
                return tokenSellTx;
            }
            else {
                return null;
            }
        }
        catch (error) {
            return null;
        }
    }
    catch (error) {
        return null;
    }
});
main();
