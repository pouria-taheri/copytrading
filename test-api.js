/**
 * Simple test script to verify NOF1.ai API is working
 */

const fetch = require("node-fetch");

async function testAPI() {
  console.log("🧪 Testing NOF1.ai API...\n");

  try {
    console.log("📡 Fetching from: https://nof1.ai/api/positions?limit=1000");
    const response = await fetch("https://nof1.ai/api/positions?limit=1000", {
      headers: {
        "User-Agent": "DeepSeek-CopyTrader/1.0",
        Accept: "application/json",
      },
      timeout: 30000,
    });

    console.log(
      `✅ Response status: ${response.status} ${response.statusText}`
    );

    if (response.ok) {
      const data = await response.json();
      console.log(`📊 Response structure:`, {
        hasPositions: !!data.positions,
        positionsCount: data.positions ? data.positions.length : 0,
        serverTime: data.serverTime,
      });

      if (data.positions && Array.isArray(data.positions)) {
        console.log("\n📋 Available models:");
        data.positions.forEach((model, index) => {
          const positionCount = model.positions
            ? Object.keys(model.positions).length
            : 0;
          console.log(
            `  ${index + 1}. ${model.id} (${positionCount} positions)`
          );
        });

        // Find DeepSeek model
        const deepSeekModel = data.positions.find(
          (model) => model.id && model.id.toLowerCase().startsWith("deepseek")
        );

        if (deepSeekModel) {
          console.log(`\n🎯 Found DeepSeek model: ${deepSeekModel.id}`);
          console.log(`📈 Positions:`, Object.keys(deepSeekModel.positions));

          // Show sample position
          const firstSymbol = Object.keys(deepSeekModel.positions)[0];
          if (firstSymbol) {
            const position = deepSeekModel.positions[firstSymbol];
            console.log(`\n📊 Sample position (${firstSymbol}):`, {
              entry_oid: position.entry_oid,
              entry_price: position.entry_price,
              leverage: position.leverage,
              quantity: position.quantity,
              symbol: position.symbol,
            });
          }
        } else {
          console.log("\n⚠️  No DeepSeek model found");
        }
      }
    } else {
      console.log(`❌ API returned error: ${response.status}`);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.code === "ETIMEDOUT") {
      console.log("💡 This is a network timeout - try again in a few minutes");
    }
  }
}

// Run the test
if (require.main === module) {
  testAPI().catch(console.error);
}

module.exports = testAPI;

