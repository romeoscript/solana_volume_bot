import { useState, useEffect } from 'react'
import axios from 'axios'

const API_BASE = 'http://localhost:3001/api'

function App() {
  const [mainWallet, setMainWallet] = useState(null)
  const [subWallets, setSubWallets] = useState([])
  const [startLoading, setStartLoading] = useState(false)
  const [stopLoading, setStopLoading] = useState(false)
  const [gatherLoading, setGatherLoading] = useState(false)
  const [configLoading, setConfigLoading] = useState(false)
  const [error, setError] = useState('')
  const [logs, setLogs] = useState([])
  const [tokenMint, setTokenMint] = useState('')

  const fetchMainWallet = async () => {
    try {
      const response = await axios.get(`${API_BASE}/main-wallet`)
      setMainWallet(response.data)
    } catch (err) {
      setError('Failed to fetch main wallet: ' + err.message)
    }
  }

  const fetchSubWallets = async () => {
    try {
      const response = await axios.get(`${API_BASE}/sub-wallets`)
      setSubWallets(response.data)
    } catch (err) {
      setError('Failed to fetch sub-wallets: ' + err.message)
    }
  }

  const fetchTokenMint = async () => {
    try {
      const response = await axios.get(`${API_BASE}/token-mint`)
      setTokenMint(response.data.tokenMint || '')
    } catch (err) {
      setError('Failed to fetch token mint: ' + err.message)
    }
  }

  const fetchLogs = async () => {
    try {
      const response = await axios.get(`${API_BASE}/logs`)
      setLogs(response.data.logs || [])
    } catch (err) {
      setLogs([`Failed to fetch logs: ${err.message}`])
    }
  }

  const startBot = async () => {
    setStartLoading(true)
    try {
      await axios.post(`${API_BASE}/start-bot`)
      alert('Bot started!')
    } catch (err) {
      setError('Failed to start bot: ' + err.message)
    }
    setStartLoading(false)
  }

  const stopBot = async () => {
    setStopLoading(true)
    try {
      await axios.post(`${API_BASE}/stop-bot`)
      alert('Bot stopped!')
    } catch (err) {
      setError('Failed to stop bot: ' + (err.response?.data?.error || err.message))
    }
    setStopLoading(false)
  }

  const runGather = async () => {
    setGatherLoading(true)
    try {
      await axios.post(`${API_BASE}/gather`)
      alert('Gather completed!')
      fetchMainWallet()
      fetchSubWallets()
    } catch (err) {
      setError('Failed to run gather: ' + err.message)
    }
    setGatherLoading(false)
  }

  const updateTokenMint = async () => {
    setConfigLoading(true)
    try {
      await axios.post(`${API_BASE}/token-mint`, { tokenMint })
      alert('Token mint updated successfully!')
    } catch (err) {
      setError('Failed to update token mint: ' + (err.response?.data?.error || err.message))
    }
    setConfigLoading(false)
  }

  useEffect(() => {
    fetchMainWallet()
    fetchSubWallets()
    fetchTokenMint()
    fetchLogs()
    const interval = setInterval(fetchLogs, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-2 md:px-0">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-center text-blue-700 mb-8 tracking-tight">Solana Volume Bot Dashboard</h1>
        {error && <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded mb-6 text-center">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Main Wallet */}
          <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center border border-gray-200">
            <h2 className="text-lg font-semibold text-blue-600 mb-2">Main Wallet</h2>
            {mainWallet ? (
              <>
                <div className="text-xs text-gray-500 break-all mb-2">{mainWallet.address}</div>
                <div className="text-2xl font-bold text-green-600">{mainWallet.balance.toFixed(6)} <span className="text-base font-medium text-gray-600">SOL</span></div>
              </>
            ) : (
              <div className="text-gray-400">Loading...</div>
            )}
          </div>

          {/* Controls */}
          <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center border border-gray-200">
            <h2 className="text-lg font-semibold text-blue-600 mb-4">Controls</h2>
            <button
              onClick={startBot}
              disabled={startLoading}
              className="w-full mb-3 py-2 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold transition disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {startLoading ? 'Starting...' : 'Start Bot'}
            </button>
            <button
              onClick={stopBot}
              disabled={stopLoading}
              className="w-full mb-3 py-2 px-4 rounded bg-red-600 hover:bg-red-700 text-white font-semibold transition disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {stopLoading ? 'Stopping...' : 'Stop Bot'}
            </button>
            <button
              onClick={runGather}
              disabled={gatherLoading}
              className="w-full py-2 px-4 rounded bg-green-600 hover:bg-green-700 text-white font-semibold transition disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {gatherLoading ? 'Gathering...' : 'Gather Funds'}
            </button>
          </div>

          {/* Token Configuration */}
          <div className="bg-white rounded-xl shadow p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-blue-600 mb-4">Token Configuration</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Token Mint Address</label>
                <input
                  type="text"
                  value={tokenMint}
                  onChange={(e) => setTokenMint(e.target.value)}
                  placeholder="Enter token mint address..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={updateTokenMint}
                disabled={configLoading}
                className="w-full py-2 px-4 rounded bg-purple-600 hover:bg-purple-700 text-white font-semibold transition disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {configLoading ? 'Saving...' : 'Save Token Mint'}
              </button>
            </div>
          </div>

          {/* Sub-Wallets */}
          <div className="bg-white rounded-xl shadow p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-blue-600 mb-4">Sub-Wallets <span className="text-gray-500">({subWallets.length})</span></h2>
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
              {subWallets.length === 0 && <div className="text-gray-400">No sub-wallets found</div>}
              {subWallets.map((wallet, index) => (
                <div key={index} className="py-2 flex flex-col">
                  <span className="text-xs text-gray-500 break-all">{wallet.address}</span>
                  <span className="text-green-700 font-semibold">{wallet.balance.toFixed(6)} SOL</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Logs Section */}
        <div className="bg-white rounded-xl shadow p-6 border border-gray-200 mt-8">
          <h2 className="text-lg font-semibold text-blue-600 mb-4">Progress Logs</h2>
          <div className="max-h-64 overflow-y-auto text-xs font-mono bg-gray-100 rounded p-2 border border-gray-200">
            {logs.length === 0 ? (
              <div className="text-gray-400">No logs yet</div>
            ) : (
              logs.map((log, idx) => <div key={idx} className="text-gray-700 whitespace-pre-line">{log}</div>)
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
