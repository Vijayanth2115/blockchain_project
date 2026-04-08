import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const DAO_ADDRESS = process.env.DAO_ADDRESS;
const WS_URL = "ws://127.0.0.1:8545";

const DAO_ABI = JSON.parse(
  fs.readFileSync("./DAO.json", "utf8")
);

let provider;
let dao;
let lastProcessedBlock = 0; // ✅ START FROM 0


// ==========================
// 🔵 HANDLE PROPOSAL CREATED
// ==========================
async function handleProposalCreated(id, description, proposer, deadline) {

  console.log("\n🆕 New Proposal Created!");
  console.log("ID:", id.toString());
  console.log("By:", proposer);
  console.log("Description:", description);
  console.log("Deadline:", new Date(Number(deadline) * 1000).toLocaleString());

  try {
    const res = await fetch("http://localhost:8000/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        proposal_id: id.toString(),
        description: description,
        created_by: proposer.toString(),
        deadline: deadline.toString()
      })
    });

    const text = await res.text();

    try {
      const data = JSON.parse(text);
      console.log("🧠 AI Advisor Response:", data);
    } catch {
      console.log("⚠️ Non-JSON advisor response:", text);
    }

  } catch (err) {
    console.error("❌ Advisor API Error:", err);
  }
}


// ==========================
// 🟢 HANDLE PROPOSAL EXECUTED
// ==========================
async function handleProposalExecuted(proposalId) {

  console.log("\n🚀 Proposal Executed!");
  console.log("Proposal ID:", proposalId.toString());

  const proposal = await dao.getProposal(proposalId);
  const description = proposal[0];
  const proposer = proposal[7];

  console.log("Description:", description);

  try {
    const res = await fetch("http://localhost:8000/process", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        proposal_id: proposalId.toString(),
        description: description,
        created_by: proposer.toString()       
      })
    });

    const text = await res.text();

    try {
      const data = JSON.parse(text);
      console.log("🤖 MCP Execution Response:", data);
    } catch {
      console.log("⚠️ Non-JSON execution response:", text);
    }

  } catch (err) {
    console.error("❌ Execution API Error:", err);
  }
}


// ==========================
// 🔍 SCAN PAST EVENTS
// ==========================
async function scanPastEvents() {

  console.log("🔍 Scanning past events...");

  const currentBlock = await provider.getBlockNumber();

  const createdEvents = await dao.queryFilter(
    "ProposalCreated",
    lastProcessedBlock,
    currentBlock
  );

  console.log("📊 Found ProposalCreated events:", createdEvents.length);

  for (const event of createdEvents) {
    const { id, description, proposer, deadline } = event.args;
    await handleProposalCreated(id, description, proposer, deadline);
  }

  const executedEvents = await dao.queryFilter(
    "ProposalExecuted",
    lastProcessedBlock,
    currentBlock
  );

  for (const event of executedEvents) {
    await handleProposalExecuted(event.args.id);
  }

  lastProcessedBlock = currentBlock + 1;
}



async function startListener() {

  console.log("🔄 Connecting to blockchain...");
  console.log("Using DAO Address:", DAO_ADDRESS);

  provider = new ethers.WebSocketProvider(WS_URL);

  dao = new ethers.Contract(
    DAO_ADDRESS,
    DAO_ABI.abi,
    provider
  );

  // Start from block 0 OR latest (your choice)
  lastProcessedBlock = await provider.getBlockNumber(); // scan all past once

  console.log("🔌 DAO Backend Listener started...");
  console.log("📡 Listening for ProposalCreated & ProposalExecuted events...");

  // ✅ RUN ONLY ONCE
  await scanPastEvents();

  // 🔵 REAL-TIME ONLY AFTER THIS
  dao.on("ProposalCreated", async (id, description, proposer, deadline) => {
    console.log("⚡ Real-time event detected!");
    await handleProposalCreated(id, description, proposer, deadline);
  });

  dao.on("ProposalExecuted", async (proposalId) => {
    console.log("🚀 Execution event detected!");
    await handleProposalExecuted(proposalId);
  });
}


// ==========================
// ▶️ RUN
// ==========================
startListener();