import { v2 as cloudinary } from "cloudinary";

// ─── 1. CONFIGURE CLOUDINARY ───────────────────────────────
cloudinary.config({
  cloud_name: "dwgv9eteo",
  api_key: "942696219921374",
  api_secret: "YS-n638evHEG8Or-43LnQ0BqLqw",
});

async function main() {
  try {
    // ─── 2. UPLOAD AN IMAGE ──────────────────────────────────
    console.log("Uploading image to Cloudinary...\n");

    const uploadResult = await cloudinary.uploader.upload(
      "https://res.cloudinary.com/demo/image/upload/getting-started/shoes.jpg",
      { public_id: "connectify_test_shoes" }
    );

    console.log("✅ Upload Successful!");
    console.log("   Secure URL:", uploadResult.secure_url);
    console.log("   Public ID: ", uploadResult.public_id);

    // ─── 3. GET IMAGE DETAILS ────────────────────────────────
    console.log("\nFetching image metadata...\n");

    const imageDetails = await cloudinary.api.resource(uploadResult.public_id);

    console.log("📋 Image Details:");
    console.log("   Width:     ", imageDetails.width, "px");
    console.log("   Height:    ", imageDetails.height, "px");
    console.log("   Format:    ", imageDetails.format);
    console.log("   File Size: ", imageDetails.bytes, "bytes");

    // ─── 4. TRANSFORM THE IMAGE ──────────────────────────────
    // f_auto → Cloudinary automatically picks the best format (WebP, AVIF, etc.) based on the browser
    // q_auto → Cloudinary automatically adjusts quality to reduce file size without visible loss
    const transformedUrl = cloudinary.url(uploadResult.public_id, {
      fetch_format: "auto", // f_auto
      quality: "auto",      // q_auto
    });

    console.log("\n🎉 Done! Click the link below to see the optimized version of the image.");
    console.log("   Check the size and the format.\n");
    console.log("   Transformed URL:", transformedUrl);

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main();
