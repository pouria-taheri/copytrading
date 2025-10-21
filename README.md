# DeepSeek CopyTrader

Monitors DeepSeek model on NOF1.ai and automatically mirrors new open positions.

## Features

- 🔄 **Automatic Monitoring**: Polls NOF1.ai API every 12 seconds
- 🎯 **DeepSeek Detection**: Finds models with IDs starting with "deepseek"
- 📊 **Position Tracking**: Tracks new positions using `entry_oid`
- 💾 **Persistent Storage**: Saves seen positions to `seen_positions.json`
- 🔄 **Error Handling**: Retries on errors with 30-second intervals
- 🛡️ **Graceful Shutdown**: Handles SIGINT/SIGTERM signals

## Installation

```bash
npm install
```

## Usage

### Start the CopyTrader

```bash
npm start
```

### Run Tests

```bash
npm test
```

## Configuration

The script monitors: `https://nof1.ai/api/positions?limit=1000`

- **Poll Interval**: 12 seconds
- **Error Retry**: 30 seconds
- **Storage**: `seen_positions.json`

## How It Works

1. **Fetches Positions**: GET request to NOF1.ai API
2. **Finds DeepSeek Model**: Searches for models with ID starting with "deepseek"
3. **Processes Positions**: Extracts symbol, price, leverage, quantity, time, and OID
4. **Tracks New Trades**: Compares `entry_oid` against previously seen positions
5. **Triggers Mirror**: Calls `openTrade()` function for new positions

## Customizing the Trade Function

Replace the `openTrade()` function in `deepseek-copytrader.js` with your exchange API:

```javascript
async openTrade(symbol, entryPrice, leverage, quantity, entryTime, entryOid) {
    // Your exchange API call here
    await exchangeClient.openPosition({
        symbol: symbol,
        side: 'long', // or determine based on your logic
        amount: quantity,
        leverage: leverage,
        price: entryPrice
    });
}
```

## Example Output

```
🚀 Starting DeepSeek CopyTrader...
📡 Monitoring: https://nof1.ai/api/positions?limit=1000
⏱️  Poll interval: 12000ms
Loaded 0 previously seen positions
✅ Processed 5 positions for DeepSeek model
🟢 New DeepSeek position opened on BTCUSDT at 50000
📊 Trade parameters: { symbol: 'BTCUSDT', entryPrice: 50000, leverage: 10, quantity: 0.1, entryTime: '2024-01-01T00:00:00Z', entryOid: 'abc123' }
```

## Error Handling

- **Network Errors**: Retries every 30 seconds
- **Malformed JSON**: Skips gracefully
- **Missing DeepSeek Model**: Logs warning and continues
- **File I/O Errors**: Logs error but continues operation

## Requirements

- Node.js >= 14.0.0
- Internet connection
- Access to NOF1.ai API

## License

MIT
