// const { ethers } = require("ethers");
// const fs = require("fs");
// require("dotenv").config();

// // Load ABI
// const daoJson = JSON.parse(fs.readFileSync("./DAO.json", "utf8"));
// const ABI = daoJson.abi;

// // Connect to Hardhat local blockchain
// const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

// // Create contract instance
// const dao = new ethers.Contract(
//   process.env.DAO_ADDRESS,
//   ABI,
//   provider
// );

// console.log("🔌 DAO Backend Listener started...");
// console.log("📡 Listening for ProposalExecuted events...");

// // Listen for execution event
// dao.on("ProposalExecuted", async (proposalId) => {

//   console.log("\n🚀 Proposal Executed!");
//   console.log("ID:", proposalId.toString());

//   try {
//     const proposal = await dao.getProposal(proposalId);

//     console.log("Description:", proposal[0]);
//     console.log("Type:", proposal[1].toString());
//     console.log("YES votes:", proposal[2].toString());
//     console.log("NO votes:", proposal[3].toString());
//     console.log("Executed:", proposal[4]);

//     console.log("✅ Backend reaction complete");

//   } catch (err) {
//     console.error("❌ Error fetching proposal:", err);
//   }

// });


import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const RPC_URL = "http://127.0.0.1:8545";
const DAO_ADDRESS = process.env.DAO_ADDRESS;

// Read ABI manually from file
const DAO_ABI = JSON.parse(
  fs.readFileSync(new URL("./DAO.json", import.meta.url))
);

const provider = new ethers.JsonRpcProvider(RPC_URL);
const dao = new ethers.Contract(DAO_ADDRESS, DAO_ABI.abi, provider);

console.log("🔌 DAO Backend Listener started...");
console.log("📡 Listening for ProposalExecuted events...");

dao.on("ProposalExecuted", async (proposalId) => {
  console.log("🚀 Proposal Executed!");
  console.log("Proposal ID:", proposalId.toString());

  // Here automation will go
});
