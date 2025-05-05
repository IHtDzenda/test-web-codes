/**
 * Tests multiple codec configurations to find supported ones
 */
async function findSupportedCodecs(): Promise<string[]> {
  if (!("VideoDecoder" in window)) {
    console.error("WebCodecs API is not supported in this browser");
    return [];
  }

  // Output container
  const resultsContainer = document.getElementById("results-container")!;
  resultsContainer.innerHTML = "<p>Testing codecs... this may take a moment.</p>";

  // Different codec configurations
  const configurations = [
    // H.264/AVC
    {
      name: "H.264/AVC",
      prefixes: ["avc1"],
      profiles: ["42", "4D", "58", "64"], // Baseline, Main, Extended, High
      tiers: ["00"], // No tiers in H.264
      levels: ["1F", "28", "2A", "32", "3C", "42", "4D", "50", "64"], // Various levels
      flags: [""],
      extras: ["avc1", "avc1.42E01E", "avc1.640028", "avc1.64001F"]
    },
    // H.265/HEVC
    {
      name: "H.265/HEVC",
      prefixes: ["hev1", "hvc1"],
      profiles: ["1", "2"], // Main, Main10
      tiers: ["0", "4", "6"], // Main tier options
      levels: ["L51", "L93", "L90", "L120", "L123", "L150", "L153"],
      flags: ["B0", ""],
      extras: ["hvc1", "hev1"]
    },
    // VP8/VP9
    {
      name: "VP8/VP9",
      extras: ["vp8", "vp8.0", "vp9", "vp9.0", "vp09.00.10.08", "vp09.01.20.08", "vp09.02.10.10"]
    },
    // AV1
    {
      name: "AV1",
      extras: [
        "av01.0.00M.08", "av01.0.01M.08", "av01.0.04M.08", 
        "av01.0.08M.08", "av01.0.15M.08", "av01.0.31M.08",
        "av01.1.31M.10"
      ]
    }
  ];

  resultsContainer.innerHTML = "";

  // Map to store results with type hints for TypeScript
  const results: Record<string, {supported: string[], unsupported: string[]}> = {};
  const allSupportedCodecs: string[] = [];

  // Process each codec type
  for (const config of configurations) {
    const categoryName = config.name;
    results[categoryName] = { supported: [], unsupported: [] };
    
    // Add header for this codec type
    resultsContainer.innerHTML += `<h3>${categoryName}</h3>`;
    
    const codecsToTest: string[] = [];
    
    // Generate combinatorial patterns if configuration parameters exist
    if (config.prefixes && config.profiles && config.tiers && config.levels) {
      config.prefixes.forEach(prefix => {
        config.profiles!.forEach(profile => {
          config.tiers!.forEach(tier => {
            config.levels!.forEach(level => {
              config.flags!.forEach(flag => {
                // Handle different format patterns based on codec type
                let codec = "";
                if (categoryName === "H.264/AVC") {
                  codec = `${prefix}.${profile}${tier}${level}`;
                } else if (categoryName === "H.265/HEVC") {
                  codec = `${prefix}.${profile}.${tier}.${level}${flag ? "." + flag : ""}`;
                }
                codecsToTest.push(codec);
              });
            });
          });
        });
      });
    }
    
    // Add any extra specific formats to test
    if (config.extras) {
      codecsToTest.push(...config.extras);
    }
    
    // Test each codec string for this category
    for (const codec of codecsToTest) {
      try {
        const support = await VideoDecoder.isConfigSupported({
          codec,
          optimizeForLatency: true,
        });
        
        if (support.supported) {
          results[categoryName].supported.push(codec);
          allSupportedCodecs.push(codec);
          resultsContainer.innerHTML += `<div class="supported">✅ ${codec}</div>`;
        } else {
          results[categoryName].unsupported.push(codec);
          resultsContainer.innerHTML += `<div class="not-supported">❌ ${codec}</div>`;
        }
      } catch (error) {
        results[categoryName].unsupported.push(codec);
        resultsContainer.innerHTML += `<div class="not-supported">❌ ${codec} (Error: ${error instanceof Error ? error.message : "Unknown error"})</div>`;
      }
      
      // Allow UI to update
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  // Display summary
  const summaryContainer = document.getElementById("summary-container")!;
  summaryContainer.innerHTML = `Found ${allSupportedCodecs.length} supported codecs out of ${
    Object.values(results).reduce((total, category) => 
      total + category.supported.length + category.unsupported.length, 0)
  } tested`;
  
  // Enable copy button
  const btn = document.getElementById("copy-button") as HTMLButtonElement ;
  btn.disabled = false;
  
  // Store result data for copying
  (window as any).codecTestResults = {
    browser: navigator.userAgent,
    results,
    allSupportedCodecs
  };
  
  return allSupportedCodecs;
}

/**
 * Tries to configure a decoder with the first supported codec
 */
async function testAndConfigureDecoder(supportedCodecs: string[]): Promise<VideoDecoder | null> {
  if (supportedCodecs.length === 0) {
    console.error("No codec configurations are supported in this browser");
    return null;
  }
  
  try {
    const decoder = new VideoDecoder({
      output: frame => {
        console.log("Frame decoded:", frame);
        frame.close();
      },
      error: e => console.error("Decoder error:", e)
    });
    
    decoder.configure({
      codec: supportedCodecs[0],
      optimizeForLatency: true
    });
    
    const resultsContainer = document.getElementById("results-container")!;
    resultsContainer.innerHTML += `
      <div class="summary supported">
        <strong>Successfully configured decoder with codec: ${supportedCodecs[0]}</strong>
      </div>
    `;
    
    return decoder;
  } catch (error) {
    const resultsContainer = document.getElementById("results-container")!;
    resultsContainer.innerHTML += `
      <div class="summary not-supported">
        <strong>Failed to configure decoder: ${error instanceof Error ? error.message : "Unknown error"}</strong>
      </div>
    `;
    
    return null;
  }
}

// Set up event listeners when the page loads
document.addEventListener("DOMContentLoaded", () => {
  // Test button functionality
  document.getElementById("test-button")!.addEventListener("click", async () => {
    const button = document.getElementById("test-button") as HTMLButtonElement;
    button.disabled = true;
    button.textContent = "Testing...";
    
    try {
      const supportedCodecs = await findSupportedCodecs();
      await testAndConfigureDecoder(supportedCodecs);
    } catch (error) {
      console.error("Test failed:", error);
      document.getElementById("results-container")!.innerHTML += `
        <div class="not-supported">Test failed: ${error instanceof Error ? error.message : "Unknown error"}</div>
      `;
    } finally {
      button.disabled = false;
      button.textContent = "Test All Codec Combinations";
    }
  });
  
  // Copy button functionality
  document.getElementById("copy-button")!.addEventListener("click", () => {
    const results = (window as any).codecTestResults;
    if (results) {
      navigator.clipboard.writeText(JSON.stringify(results, null, 2))
        .then(() => {
          alert("Results copied to clipboard!");
        })
        .catch(err => {
          console.error("Failed to copy results:", err);
          alert("Failed to copy results to clipboard. See console for details.");
        });
    }
  });
});
