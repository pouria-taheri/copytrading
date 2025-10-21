/**
 * Network troubleshooting script
 */

const https = require("https");
const http = require("http");

async function testNetwork() {
  console.log("🔍 Network Troubleshooting for NOF1.ai\n");

  // Test 1: Basic DNS resolution
  console.log("Test 1: DNS Resolution");
  try {
    const dns = require("dns").promises;
    const addresses = await dns.resolve4("nof1.ai");
    console.log(`✅ DNS resolved: ${addresses.join(", ")}`);
  } catch (error) {
    console.log(`❌ DNS resolution failed: ${error.message}`);
  }

  // Test 2: HTTP request with different options
  console.log("\nTest 2: HTTP Request with custom options");
  try {
    const options = {
      hostname: "nof1.ai",
      port: 443,
      path: "/api/positions?limit=10",
      method: "GET",
      headers: {
        "User-Agent": "DeepSeek-CopyTrader/1.0",
        Accept: "application/json",
      },
      timeout: 15000,
    };

    const response = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode, data }));
      });

      req.on("error", reject);
      req.on("timeout", () => reject(new Error("Request timeout")));
      req.setTimeout(15000);
      req.end();
    });

    console.log(`✅ HTTP request successful: ${response.status}`);
    if (response.status === 200) {
      try {
        const jsonData = JSON.parse(response.data);
        console.log(
          `📊 Response contains ${
            jsonData.positions ? jsonData.positions.length : 0
          } models`
        );
      } catch (e) {
        console.log("⚠️  Response is not valid JSON");
      }
    }
  } catch (error) {
    console.log(`❌ HTTP request failed: ${error.message}`);
  }

  // Test 3: Alternative endpoints
  console.log("\nTest 3: Alternative endpoints");
  const endpoints = [
    "https://nof1.ai/",
    "https://nof1.ai/api/",
    "https://httpbin.org/get", // Test external connectivity
  ];

  for (const url of endpoints) {
    try {
      const response = await fetch(url, { timeout: 10000 });
      console.log(`✅ ${url}: ${response.status}`);
    } catch (error) {
      console.log(`❌ ${url}: ${error.message}`);
    }
  }

  console.log("\n💡 Troubleshooting suggestions:");
  console.log("1. Try running as administrator");
  console.log("2. Check Windows Firewall settings");
  console.log("3. Try disabling antivirus temporarily");
  console.log("4. Check if you're behind a corporate proxy");
  console.log("5. Try using a different network (mobile hotspot)");
}

// Run the test
if (require.main === module) {
  testNetwork().catch(console.error);
}

module.exports = testNetwork;

