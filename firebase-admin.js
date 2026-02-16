// WARNING: This file is for SERVER-SIDE use only (Node.js).
// DO NOT include this in your client-side web application (HTML/JS) as it exposes your private keys.

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// Load credentials from the .env file (which contains JSON)
// Using path.join ensures we find the file relative to this script
const serviceAccountPath = path.join(__dirname, "node_modules", ".env");
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // databaseURL: "https://loan-book-4e1a4.firebaseio.com" 
  });

  console.log("Firebase Admin SDK initialized successfully.");
} catch (error) {
  console.error("Error initializing Firebase Admin SDK:", error);
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };