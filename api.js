const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { exec } = require('child_process');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

let botProcess = null;

// Get main wallet address and balance
app.get('/api/main-wallet', (req, res) => {
  // Read PRIVATE_KEY from .env and get public key
  try {
    const bs58 = require('bs58');
    const { Keypair, Connection, clusterApiUrl } = require('@solana/web3.js');
    const key = bs58.decode(process.env.PRIVATE_KEY);
    const kp = Keypair.fromSecretKey(key);
    const connection = new Connection(process.env.RPC_ENDPOINT || clusterApiUrl('mainnet-beta'));
    connection.getBalance(kp.publicKey).then(balance => {
      res.json({
        address: kp.publicKey.toBase58(),
        balance: balance / 1e9
      });
    }).catch(e => res.status(500).json({ error: e.message }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get sub-wallets and balances
app.get('/api/sub-wallets', async (req, res) => {
  try {
    const bs58 = require('bs58');
    const { Keypair, Connection, clusterApiUrl } = require('@solana/web3.js');
    const walletsData = JSON.parse(fs.readFileSync('data.json', 'utf-8'));
    const connection = new Connection(process.env.RPC_ENDPOINT || clusterApiUrl('mainnet-beta'));
    const results = [];
    for (const { privateKey, pubkey } of walletsData) {
      const kp = Keypair.fromSecretKey(bs58.decode(privateKey));
      const balance = await connection.getBalance(kp.publicKey);
      results.push({ address: pubkey, balance: balance / 1e9 });
    }
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Start the bot
app.post('/api/start-bot', (req, res) => {
  if (botProcess && !botProcess.killed) {
    return res.status(400).json({ error: 'Bot is already running.' });
  }
  botProcess = exec('npm start', (err, stdout, stderr) => {
    // Optionally handle process exit here
  });
  res.json({ output: 'Bot started.' });
});

app.post('/api/stop-bot', (req, res) => {
  if (botProcess && !botProcess.killed) {
    botProcess.kill('SIGTERM');
    botProcess = null;
    res.json({ output: 'Bot stopped.' });
  } else {
    res.status(400).json({ error: 'Bot is not running.' });
  }
});

// Run gather
app.post('/api/gather', (req, res) => {
  exec('npm run gather', (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: stderr });
    res.json({ output: stdout });
  });
});

// Get .env config
app.get('/api/config', (req, res) => {
  try {
    const env = fs.readFileSync('.env', 'utf-8');
    res.type('text/plain').send(env);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update .env config
app.post('/api/config', (req, res) => {
  try {
    fs.writeFileSync('.env', req.body.env);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Add logs endpoint
app.get('/api/logs', (req, res) => {
  try {
    // Ensure the file exists
    if (!fs.existsSync('progress.log')) {
      fs.writeFileSync('progress.log', '');
    }
    const logs = fs.readFileSync('progress.log', 'utf-8').split('\n').slice(-100);
    res.json({ logs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get token mint
app.get('/api/token-mint', (req, res) => {
  try {
    res.json({ tokenMint: process.env.TOKEN_MINT || '' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update token mint
app.post('/api/token-mint', (req, res) => {
  try {
    const { tokenMint } = req.body;
    if (!tokenMint) {
      return res.status(400).json({ error: 'Token mint is required' });
    }
    
    // Read current .env file
    let envContent = fs.readFileSync('.env', 'utf-8');
    
    // Update TOKEN_MINT line
    if (envContent.includes('TOKEN_MINT=')) {
      envContent = envContent.replace(/TOKEN_MINT=.*/g, `TOKEN_MINT=${tokenMint}`);
    } else {
      envContent += `\nTOKEN_MINT=${tokenMint}`;
    }
    
    // Write back to .env file
    fs.writeFileSync('.env', envContent);
    
    // Update process.env for current session
    process.env.TOKEN_MINT = tokenMint;
    
    res.json({ success: true, tokenMint });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
}); 