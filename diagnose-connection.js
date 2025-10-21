/**
 * Diagnostic script to test connection to NOF1.ai
 */

const fetch = require("node-fetch");

async function diagnoseConnection() {
  console.log("🔍 Diagnosing connection to NOF1.ai...\n");

  // Test 1: Basic connectivity
  console.log("Test 1: Basic connectivity to nof1.ai");
  try {
    const response = await fetch("https://nof1.ai", {
      method: "HEAD",
      timeout: 10000,
    });
    console.log(
      `✅ Basic connectivity: ${response.status} ${response.statusText}\n`
    );
  } catch (error) {
    console.log(`❌ Basic connectivity failed: ${error.message}\n`);
  }

  // Test 2: API endpoint
  console.log("Test 2: API endpoint accessibility");
  try {
    const response = await fetch("https://nof1.ai/api/positions?limit=10", {
      headers: {
        "User-Agent": "DeepSeek-CopyTrader/1.0",
        Accept: "application/json",
      },
      timeout: 15000,
    });
    console.log(`✅ API endpoint: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log(
        `📊 Response contains ${
          Array.isArray(data) ? data.length : "unknown"
        } items`
      );
      if (Array.isArray(data) && data.length > 0) {
        console.log(
          `📋 Sample model IDs: ${data
            .slice(0, 3)
            .map((m) => m.id)
            .join(", ")}`
        );
      }
    }
    console.log("");
  } catch (error) {
    console.log(`❌ API endpoint failed: ${error.message}\n`);
  }

  // Test 3: Alternative endpoints
  console.log("Test 3: Alternative endpoints");
  const endpoints = [
    "https://nof1.ai/api/models",
    "https://nof1.ai/api/",
    "https://nof1.ai/",
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { timeout: 10000 });
      console.log(`✅ ${endpoint}: ${response.status}`);
    } catch (error) {
      console.log(`❌ ${endpoint}: ${error.message}`);
    }
  }

  console.log("\n💡 Troubleshooting tips:");
  console.log("1. Check your internet connection");
  console.log("2. Try accessing https://nof1.ai in your browser");
  console.log("3. The API might be temporarily down");
  console.log("4. Try running the script again in a few minutes");
}

// Run diagnostics
if (require.main === module) {
  diagnoseConnection().catch(console.error);
}

module.exports = diagnoseConnection;

