/**
 * Monitors DeepSeek model on NOF1.ai and automatically mirrors new open positions.
 */

const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");

// Configuration
const API_URL = "https://nof1.ai/api/account-totals";
const SEEN_POSITIONS_FILE = "seen_positions.json";
const POLL_INTERVAL = 15000; // 15 seconds
const ERROR_RETRY_INTERVAL = 45000; // 45 seconds
const LOG_VERBOSE = true;

class DeepSeekCopyTrader {
  constructor() {
    this.seenPositions = new Set();
    this.isRunning = false;
  }

  async loadSeenPositions() {
    try {
      const data = await fs.readFile(SEEN_POSITIONS_FILE, "utf8");
      const positions = JSON.parse(data);
      this.seenPositions = new Set(positions);
      console.log(
        `Loaded ${this.seenPositions.size} previously seen positions`
      );
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("Error loading seen positions:", error.message);
      }
      this.seenPositions = new Set();
    }
  }

  async saveSeenPositions() {
    try {
      const positions = Array.from(this.seenPositions);
      await fs.writeFile(
        SEEN_POSITIONS_FILE,
        JSON.stringify(positions, null, 2)
      );
    } catch (error) {
      console.error("Error saving seen positions:", error.message);
    }
  }

  getTimestamp() {
    return new Date().toISOString().replace("T", " ").substring(0, 19);
  }

  formatEntryTime(entryTime) {
    if (!entryTime) return "N/A";
    const date = new Date(entryTime * 1000);
    return date.toISOString().replace("T", " ").substring(0, 19) + " UTC";
  }

  logDetailedData(data) {
    if (!LOG_VERBOSE) return;

    if (!data || !data.accountTotals || !Array.isArray(data.accountTotals)) {
      console.log(`[${this.getTimestamp()}] 📊 No account data available`);
      return;
    }

    // Filter target model accounts (DeepSeek and Qwen)
    const targetAccounts = data.accountTotals.filter((account) => {
      if (!account || !account.model_id) return false;
      const modelId = account.model_id.toLowerCase();
      return modelId.startsWith("deepseek") || modelId.startsWith("qwen");
    });

    if (targetAccounts.length === 0) {
      console.log(
        `[${this.getTimestamp()}] 📊 No DeepSeek or Qwen accounts found in data`
      );
      return;
    }

    console.log(
      `[${this.getTimestamp()}] 📊 === TARGET MODEL POSITION DATA ===`
    );
    console.log(
      `[${this.getTimestamp()}] 🤖 Found ${
        targetAccounts.length
      } DeepSeek/Qwen accounts`
    );

    targetAccounts.forEach((account, accountIndex) => {
      const modelIcon = account.model_id.toLowerCase().startsWith("deepseek")
        ? "🤖"
        : "🧠";
      console.log(
        `[${this.getTimestamp()}] ${modelIcon} Account ${accountIndex + 1}: ${
          account.model_id
        }`
      );
      console.log(
        `[${this.getTimestamp()}]   💰 Total Equity: $${
          account.dollar_equity?.toFixed(2) || "N/A"
        }`
      );
      console.log(
        `[${this.getTimestamp()}]   📈 Realized PnL: $${
          account.realized_pnl?.toFixed(2) || "N/A"
        }`
      );
      console.log(
        `[${this.getTimestamp()}]   📊 Unrealized PnL: $${
          account.total_unrealized_pnl?.toFixed(2) || "N/A"
        }`
      );
      console.log(
        `[${this.getTimestamp()}]   📈 Sharpe Ratio: ${
          account.sharpe_ratio?.toFixed(2) || "N/A"
        }`
      );
      console.log(
        `[${this.getTimestamp()}]   📊 Cumulative PnL %: ${
          account.cum_pnl_pct?.toFixed(2) || "N/A"
        }%`
      );

      if (account.positions && typeof account.positions === "object") {
        const positionCount = Object.keys(account.positions).length;
        console.log(
          `[${this.getTimestamp()}]   📈 Active Positions: ${positionCount}`
        );

        Object.entries(account.positions).forEach(([symbol, position]) => {
          const isNewPosition = !this.seenPositions.has(position.entry_oid);
          const statusIcon = isNewPosition ? "🆕" : "📊";
          const pnlIcon = position.unrealized_pnl >= 0 ? "📈" : "📉";

          console.log(`[${this.getTimestamp()}]   ${statusIcon} ${symbol}:`);
          console.log(
            `[${this.getTimestamp()}]     💰 Entry Price: $${
              position.entry_price
            }`
          );
          console.log(
            `[${this.getTimestamp()}]     📊 Current Price: $${
              position.current_price
            }`
          );
          console.log(
            `[${this.getTimestamp()}]     ${pnlIcon} Unrealized PnL: $${
              position.unrealized_pnl?.toFixed(2) || "N/A"
            }`
          );
          console.log(
            `[${this.getTimestamp()}]     ⚡ Leverage: ${position.leverage}x`
          );
          console.log(
            `[${this.getTimestamp()}]     📦 Quantity: ${position.quantity}`
          );
          console.log(
            `[${this.getTimestamp()}]     🎯 Confidence: ${position.confidence}`
          );
          console.log(
            `[${this.getTimestamp()}]     🆔 Entry OID: ${position.entry_oid}`
          );
          console.log(
            `[${this.getTimestamp()}]     💸 Commission: $${
              position.commission
            }`
          );
          console.log(
            `[${this.getTimestamp()}]     🎯 Margin: $${
              position.margin?.toFixed(2) || "N/A"
            }`
          );
          console.log(
            `[${this.getTimestamp()}]     🛑 Stop Loss: $${
              position.exit_plan?.stop_loss || "N/A"
            }`
          );
          console.log(
            `[${this.getTimestamp()}]     🎯 Profit Target: $${
              position.exit_plan?.profit_target || "N/A"
            }`
          );
          console.log(`[${this.getTimestamp()}]     ---`);
        });
      } else {
        console.log(`[${this.getTimestamp()}]   📊 No active positions`);
      }
    });

    console.log(`[${this.getTimestamp()}] 📊 === END TARGET MODEL DATA ===`);
  }

  async fetchPositions() {
    const maxRetries = 3;
    const retryDelay = 10000; // 10 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `[${this.getTimestamp()}] 🔄 Fetching positions from ${API_URL}...`
        );

        const response = await axios.get(API_URL, {
          timeout: 15000,
          headers: {
            "User-Agent": "DeepSeekCopyTrader/1.0",
            Accept: "application/json",
            Connection: "keep-alive",
          },
          decompress: true,
          maxRedirects: 3,
        });

        const data = response.data;
        console.log(
          `[${this.getTimestamp()}] ✅ Successfully fetched ${
            data.accountTotals ? data.accountTotals.length : 0
          } accounts`
        );

        // Detailed data logging
        this.logDetailedData(data);
        return data;
      } catch (error) {
        const isRetryableError =
          error.code === "ECONNABORTED" ||
          error.message.includes("timeout") ||
          error.code === "ETIMEDOUT" ||
          error.code === "ECONNRESET" ||
          error.code === "ENOTFOUND";

        if (isRetryableError && attempt < maxRetries) {
          console.log(
            `[${this.getTimestamp()}] 🔁 Retrying fetch (attempt ${attempt} of 3) after timeout...`
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          continue;
        }

        if (
          error.code === "ECONNABORTED" ||
          error.message.includes("timeout")
        ) {
          console.error(
            `[${this.getTimestamp()}] ⏰ Request timeout - API took too long to respond`
          );
        } else if (error.code === "ETIMEDOUT" || error.code === "ECONNRESET") {
          console.error(
            `[${this.getTimestamp()}] 🌐 Network timeout or connection reset`
          );
        } else {
          console.error(
            `[${this.getTimestamp()}] ❌ Error fetching positions:`,
            error.message
          );
        }
        throw error;
      }
    }
  }

  findTargetModelAccounts(data) {
    if (!data || !data.accountTotals || !Array.isArray(data.accountTotals)) {
      return [];
    }

    return data.accountTotals.filter((account) => {
      if (!account || !account.model_id) return false;
      const modelId = account.model_id.toLowerCase();
      return modelId.startsWith("deepseek") || modelId.startsWith("qwen");
    });
  }

  async processAccounts(accounts) {
    if (!accounts || !Array.isArray(accounts)) {
      return;
    }

    // Process each account's positions
    for (const account of accounts) {
      const { model_id, positions } = account;

      if (!positions || typeof positions !== "object") {
        continue;
      }

      // Process each position in the account
      for (const [symbol, position] of Object.entries(positions)) {
        const {
          entry_oid,
          entry_price,
          leverage,
          quantity,
          entry_time,
          current_price,
          unrealized_pnl,
          confidence,
          exit_plan,
        } = position;

        if (!entry_oid || entry_oid === -1) {
          continue;
        }

        if (!this.seenPositions.has(entry_oid)) {
          this.seenPositions.add(entry_oid);
          await this.saveSeenPositions();

          // Enhanced alert for new positions
          const modelIcon = model_id.toLowerCase().startsWith("deepseek")
            ? "🤖"
            : "🧠";
          console.log(
            `[${this.getTimestamp()}] 🚨 NEW ${model_id.toUpperCase()} POSITION OPENED! 🚨`
          );
          console.log(
            `[${this.getTimestamp()}] ${modelIcon} Model: ${model_id}`
          );
          console.log(`[${this.getTimestamp()}] 📊 Symbol: ${symbol}`);
          console.log(
            `[${this.getTimestamp()}] 💰 Entry Price: $${entry_price}`
          );
          console.log(
            `[${this.getTimestamp()}] 📊 Current Price: $${current_price}`
          );
          console.log(`[${this.getTimestamp()}] ⚡ Leverage: ${leverage}x`);
          console.log(`[${this.getTimestamp()}] 📦 Quantity: ${quantity}`);
          console.log(`[${this.getTimestamp()}] 🎯 Confidence: ${confidence}`);
          console.log(
            `[${this.getTimestamp()}] 📈 Unrealized PnL: $${
              unrealized_pnl?.toFixed(2) || "N/A"
            }`
          );
          console.log(
            `[${this.getTimestamp()}] 🛑 Stop Loss: $${
              exit_plan?.stop_loss || "N/A"
            }`
          );
          console.log(
            `[${this.getTimestamp()}] 🎯 Profit Target: $${
              exit_plan?.profit_target || "N/A"
            }`
          );
          console.log(
            `[${this.getTimestamp()}] ------------------------------`
          );

          // Call the placeholder function
          await this.openTrade(
            symbol,
            entry_price,
            leverage,
            quantity,
            entry_time,
            entry_oid,
            "long", // Default to long, could be determined by quantity sign
            model_id
          );
        }
      }
    }
  }

  async openTrade(
    symbol,
    entryPrice,
    leverage,
    quantity,
    entryTime,
    entryOid,
    side,
    modelId
  ) {
    // Placeholder function - replace with your exchange API call
    console.log(`[${this.getTimestamp()}] 📊 Trade parameters:`, {
      symbol,
      entryPrice,
      leverage,
      quantity,
      entryTime,
      entryOid,
      side,
      modelId,
    });

    // TODO: Implement your exchange API call here
    // Example:
    // await exchangeClient.openPosition({
    //     symbol: symbol,
    //     side: side, // 'long' or 'short'
    //     amount: quantity,
    //     leverage: leverage,
    //     price: entryPrice
    // });
  }

  async pollPositions() {
    try {
      const data = await this.fetchPositions();
      const targetAccounts = this.findTargetModelAccounts(data);

      if (targetAccounts.length === 0) {
        console.log(
          `[${this.getTimestamp()}] ⚠️  No DeepSeek or Qwen accounts found in response`
        );
        console.log(
          `[${this.getTimestamp()}] 📋 Available models: ${
            data.accountTotals
              ? data.accountTotals
                  .map((a) => a.model_id)
                  .filter((id, index, arr) => arr.indexOf(id) === index)
                  .join(", ")
              : "none"
          }`
        );
        return;
      }

      console.log(
        `[${this.getTimestamp()}] 🎯 Found ${
          targetAccounts.length
        } DeepSeek/Qwen accounts`
      );

      await this.processAccounts(targetAccounts);
      console.log(
        `[${this.getTimestamp()}] ✅ Processed ${
          targetAccounts.length
        } DeepSeek/Qwen accounts`
      );
    } catch (error) {
      if (
        error.name === "AbortError" ||
        error.code === "ETIMEDOUT" ||
        error.code === "ECONNRESET"
      ) {
        console.error(
          `[${this.getTimestamp()}] 🌐 Network issue - will retry in 30 seconds`
        );
      } else {
        console.error(
          `[${this.getTimestamp()}] ❌ Error in poll cycle:`,
          error.message
        );
      }
      throw error;
    }
  }

  async testConnection() {
    console.log(`[${this.getTimestamp()}] 🔍 Testing connection to NOF1.ai...`);
    try {
      const response = await axios.head("https://nof1.ai", {
        timeout: 5000,
        headers: {
          "User-Agent": "DeepSeekCopyTrader/1.0",
        },
      });
      console.log(
        `[${this.getTimestamp()}] ✅ Connection test successful (${
          response.status
        })`
      );
      return true;
    } catch (error) {
      console.log(
        `[${this.getTimestamp()}] ❌ Connection test failed: ${error.message}`
      );
      console.log(
        `[${this.getTimestamp()}] 💡 This might be a temporary network issue or the site might be down`
      );
      return false;
    }
  }

  async start() {
    console.log("🚀 Starting DeepSeek & Qwen CopyTrader...");
    console.log(`📡 Monitoring: ${API_URL}`);
    console.log(`🤖 Target Models: DeepSeek & Qwen`);
    console.log(`⏱️  Poll interval: ${POLL_INTERVAL}ms`);

    // Test connection first
    await this.testConnection();

    await this.loadSeenPositions();
    this.isRunning = true;

    const pollLoop = async () => {
      if (!this.isRunning) {
        return;
      }

      try {
        await this.pollPositions();
        setTimeout(pollLoop, POLL_INTERVAL);
      } catch (error) {
        console.error("❌ Polling error, retrying in 30 seconds...");
        setTimeout(pollLoop, ERROR_RETRY_INTERVAL);
      }
    };

    // Start the polling loop
    pollLoop();
  }

  stop() {
    console.log("🛑 Stopping DeepSeek CopyTrader...");
    this.isRunning = false;
  }
}

// Main execution
async function main() {
  const trader = new DeepSeekCopyTrader();

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    trader.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    trader.stop();
    process.exit(0);
  });

  try {
    await trader.start();
  } catch (error) {
    console.error("💥 Fatal error:", error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = DeepSeekCopyTrader;
