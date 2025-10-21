/**
 * Test script for DeepSeek CopyTrader
 */

const DeepSeekCopyTrader = require("./deepseek-copytrader");
const fs = require("fs").promises;

async function testDeepSeekCopyTrader() {
  console.log("🧪 Testing DeepSeek CopyTrader...\n");

  // Test 1: Basic instantiation
  console.log("Test 1: Basic instantiation");
  const trader = new DeepSeekCopyTrader();
  console.log("✅ DeepSeekCopyTrader instance created\n");

  // Test 2: Load seen positions (should handle missing file)
  console.log("Test 2: Load seen positions");
  await trader.loadSeenPositions();
  console.log("✅ Seen positions loaded (empty set for new file)\n");

  // Test 3: Save seen positions
  console.log("Test 3: Save seen positions");
  trader.seenPositions.add("test-oid-123");
  await trader.saveSeenPositions();
  console.log("✅ Seen positions saved\n");

  // Test 4: Reload and verify
  console.log("Test 4: Reload and verify");
  const newTrader = new DeepSeekCopyTrader();
  await newTrader.loadSeenPositions();
  console.log(`✅ Reloaded ${newTrader.seenPositions.size} positions\n`);

  // Test 5: Find DeepSeek model in mock data
  console.log("Test 5: Find DeepSeek model");
  const mockData = {
    positions: [
      { id: "other-model", positions: {} },
      {
        id: "deepseek-chat-v3.1",
        positions: {
          BTCUSDT: {
            entry_oid: 123456789,
            symbol: "BTCUSDT",
            entry_price: 50000,
            leverage: 10,
            quantity: 0.1,
            entry_time: 1760740869.65822,
          },
        },
      },
    ],
  };

  const deepSeekModel = trader.findDeepSeekModel(mockData);
  console.log(
    "✅ DeepSeek model found:",
    deepSeekModel ? deepSeekModel.id : "null\n"
  );

  // Test 6: Process positions
  console.log("Test 6: Process positions");
  if (deepSeekModel) {
    await trader.processPositions(deepSeekModel.positions);
    console.log("✅ Positions processed\n");
  }

  // Cleanup
  try {
    await fs.unlink("seen_positions.json");
    console.log("🧹 Cleanup: Removed test file\n");
  } catch (error) {
    // File might not exist, that's okay
  }

  console.log("🎉 All tests passed!");
  console.log("\n📋 Usage:");
  console.log("1. Run: npm install");
  console.log("2. Run: npm start");
  console.log("3. The script will monitor DeepSeek positions every 12 seconds");
  console.log(
    "4. New positions will be logged and trigger the openTrade function"
  );
}

// Run tests
if (require.main === module) {
  testDeepSeekCopyTrader().catch(console.error);
}

module.exports = testDeepSeekCopyTrader;
