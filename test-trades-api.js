/**
 * Quick test for the trades API
 */

const axios = require("axios");

async function testTradesAPI() {
  console.log("🧪 Testing NOF1.ai Trades API...\n");

  try {
    console.log("📡 Fetching from: https://nof1.ai/api/trades");
    const response = await axios.get("https://nof1.ai/api/trades", {
      timeout: 10000,
      headers: {
        "User-Agent": "DeepSeek-CopyTrader/1.0",
        Accept: "application/json",
      },
    });

    console.log(`✅ Response status: ${response.status}`);
    console.log(
      `📊 Response size: ${JSON.stringify(response.data).length} characters`
    );

    if (response.data && response.data.trades) {
      const trades = response.data.trades;
      console.log(`📈 Total trades: ${trades.length}`);

      // Count DeepSeek and Qwen trades
      const deepSeekTrades = trades.filter(
        (t) => t.model_id && t.model_id.toLowerCase().startsWith("deepseek")
      );
      const qwenTrades = trades.filter(
        (t) => t.model_id && t.model_id.toLowerCase().startsWith("qwen")
      );

      console.log(`🤖 DeepSeek trades: ${deepSeekTrades.length}`);
      console.log(`🧠 Qwen trades: ${qwenTrades.length}`);

      if (deepSeekTrades.length > 0) {
        console.log("\n🤖 Latest DeepSeek trade:");
        const latest = deepSeekTrades[0];
        console.log(`  Symbol: ${latest.symbol}`);
        console.log(`  Side: ${latest.side}`);
        console.log(`  Entry Price: $${latest.entry_price}`);
        console.log(`  Entry Time: ${latest.entry_human_time}`);
      }

      if (qwenTrades.length > 0) {
        console.log("\n🧠 Latest Qwen trade:");
        const latest = qwenTrades[0];
        console.log(`  Symbol: ${latest.symbol}`);
        console.log(`  Side: ${latest.side}`);
        console.log(`  Entry Price: $${latest.entry_price}`);
        console.log(`  Entry Time: ${latest.entry_human_time}`);
      }
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.code === "ETIMEDOUT") {
      console.log("💡 This is a network timeout - the API might be slow");
    }
  }
}

// Run the test
if (require.main === module) {
  testTradesAPI().catch(console.error);
}

module.exports = testTradesAPI;

