/**
 * Monitors DeepSeek model on NOF1.ai and automatically mirrors new open positions.
 */

const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");

// Configuration
const API_URL = "https://nof1.ai/api/positions?limit=1000";
const SEEN_POSITIONS_FILE = "seen_positions.json";
const POLL_INTERVAL = 12000; // 12 seconds
const ERROR_RETRY_INTERVAL = 30000; // 30 seconds
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

    if (!data || !data.positions || !Array.isArray(data.positions)) {
      console.log(`[${this.getTimestamp()}] 📊 No position data available`);
      return;
    }

    // Find the DeepSeek model
    const deepSeekModel = data.positions.find(
      (model) =>
        model && model.id && model.id.toLowerCase().startsWith("deepseek")
    );

    if (!deepSeekModel) {
      console.log(
        `[${this.getTimestamp()}] 📊 DeepSeek model not found in data`
      );
      return;
    }

    console.log(`[${this.getTimestamp()}] 📊 === DEEPSEEK POSITION DATA ===`);
    console.log(`[${this.getTimestamp()}] 🤖 Model: ${deepSeekModel.id}`);

    if (
      deepSeekModel.positions &&
      typeof deepSeekModel.positions === "object"
    ) {
      const positionCount = Object.keys(deepSeekModel.positions).length;
      console.log(
        `[${this.getTimestamp()}] 📈 Active positions: ${positionCount}`
      );

      Object.entries(deepSeekModel.positions).forEach(([symbol, position]) => {
        const isNewPosition = !this.seenPositions.has(position.entry_oid);
        const statusIcon = isNewPosition ? "🆕" : "📊";

        console.log(`[${this.getTimestamp()}] ${statusIcon} ${symbol}:`);
        console.log(
          `[${this.getTimestamp()}]   📊 Entry Price: $${position.entry_price}`
        );
        console.log(
          `[${this.getTimestamp()}]   📈 Current Price: $${
            position.current_price
          }`
        );
        console.log(
          `[${this.getTimestamp()}]   💵 Unrealized PnL: $${
            position.unrealized_pnl
          }`
        );
        console.log(
          `[${this.getTimestamp()}]   ⚡ Leverage: ${position.leverage}x`
        );
        console.log(
          `[${this.getTimestamp()}]   ⏰ Entry Time: ${this.formatEntryTime(
            position.entry_time
          )}`
        );
        console.log(
          `[${this.getTimestamp()}]   🆔 Entry OID: ${position.entry_oid}`
        );
        console.log(
          `[${this.getTimestamp()}]   📦 Quantity: ${position.quantity}`
        );
        console.log(
          `[${this.getTimestamp()}]   💸 Commission: $${position.commission}`
        );
        console.log(
          `[${this.getTimestamp()}]   🎯 Margin: $${position.margin}`
        );
        console.log(`[${this.getTimestamp()}]   ---`);
      });
    } else {
      console.log(
        `[${this.getTimestamp()}] 📊 No positions found for DeepSeek model`
      );
    }

    console.log(`[${this.getTimestamp()}] 📊 === END DEEPSEEK DATA ===`);
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
          timeout: 20000,
          headers: {
            "User-Agent": "DeepSeekCopyTrader/1.0",
            Accept: "application/json",
          },
          decompress: true,
        });

        const data = response.data;
        console.log(
          `[${this.getTimestamp()}] ✅ Successfully fetched ${
            data.positions ? data.positions.length : 0
          } models`
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

  findDeepSeekModel(data) {
    if (!data || !data.positions || !Array.isArray(data.positions)) {
      return null;
    }

    return data.positions.find((model) => {
      return model && model.id && model.id.toLowerCase().startsWith("deepseek");
    });
  }

  async processPositions(positions) {
    if (!positions || typeof positions !== "object") {
      return;
    }

    // positions is an object where keys are symbols and values are position data
    for (const [symbol, positionData] of Object.entries(positions)) {
      const { entry_oid, entry_price, leverage, quantity, entry_time } =
        positionData;

      if (!entry_oid || entry_oid === -1) {
        continue;
      }

      if (!this.seenPositions.has(entry_oid)) {
        this.seenPositions.add(entry_oid);
        await this.saveSeenPositions();

        // Enhanced alert for new positions
        console.log(`[${this.getTimestamp()}] 🚨 NEW POSITION OPENED! 🚨`);
        console.log(`[${this.getTimestamp()}] Symbol: ${symbol}`);
        console.log(`[${this.getTimestamp()}] Entry Price: $${entry_price}`);
        console.log(`[${this.getTimestamp()}] Leverage: ${leverage}x`);
        console.log(`[${this.getTimestamp()}] Quantity: ${quantity}`);
        console.log(
          `[${this.getTimestamp()}] Entry Time: ${this.formatEntryTime(
            entry_time
          )}`
        );
        console.log(`[${this.getTimestamp()}] ------------------------------`);

        // Call the placeholder function
        await this.openTrade(
          symbol,
          entry_price,
          leverage,
          quantity,
          entry_time,
          entry_oid
        );
      }
    }
  }

  async openTrade(symbol, entryPrice, leverage, quantity, entryTime, entryOid) {
    // Placeholder function - replace with your exchange API call
    console.log(`[${this.getTimestamp()}] 📊 Trade parameters:`, {
      symbol,
      entryPrice,
      leverage,
      quantity,
      entryTime,
      entryOid,
    });

    // TODO: Implement your exchange API call here
    // Example:
    // await exchangeClient.openPosition({
    //     symbol: symbol,
    //     side: 'long', // or 'short' based on your logic
    //     amount: quantity,
    //     leverage: leverage,
    //     price: entryPrice
    // });
  }

  async pollPositions() {
    try {
      const data = await this.fetchPositions();
      const deepSeekModel = this.findDeepSeekModel(data);

      if (!deepSeekModel) {
        console.log(
          `[${this.getTimestamp()}] ⚠️  DeepSeek model not found in response`
        );
        console.log(
          `[${this.getTimestamp()}] 📋 Available models: ${
            data.positions ? data.positions.map((m) => m.id).join(", ") : "none"
          }`
        );
        return;
      }

      console.log(
        `[${this.getTimestamp()}] 🎯 Found DeepSeek model: ${deepSeekModel.id}`
      );

      if (
        !deepSeekModel.positions ||
        typeof deepSeekModel.positions !== "object"
      ) {
        console.log(
          `[${this.getTimestamp()}] ⚠️  No positions found for DeepSeek model`
        );
        return;
      }

      await this.processPositions(deepSeekModel.positions);
      const positionCount = Object.keys(deepSeekModel.positions).length;
      console.log(
        `[${this.getTimestamp()}] ✅ Processed ${positionCount} positions for DeepSeek model`
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
        timeout: 10000,
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
    console.log("🚀 Starting DeepSeek CopyTrader...");
    console.log(`📡 Monitoring: ${API_URL}`);
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
