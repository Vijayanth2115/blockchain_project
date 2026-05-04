import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";
// import fetch from "node-fetch";


dotenv.config();



const TYPE_MAP = {
  0: "financial",
  1: "hiring",
  2: "governance",
  3: "operational",
  4: "security"
};

// ==========================
// ⚙️ CONFIG
// ==========================
const DAO_ADDRESS = process.env.DAO_ADDRESS;
const RPC_URL = "http://127.0.0.1:8545"; // ✅ HTTP ONLY

const DAO_ABI = JSON.parse(
  fs.readFileSync("./DAO.json", "utf8")
);

let provider;
let dao;
let lastProcessedBlock = 0;

const POLL_INTERVAL = 3000; // 3 seconds


// ==========================
// 🔵 HANDLE PROPOSAL CREATED
// ==========================
async function handleProposalCreated(id, description, category, proposer, deadline) {

  console.log("\n🆕 New Proposal Created!");
  console.log("ID:", id.toString());
  console.log("By:", proposer);
  console.log("Description:", description);
  console.log("category:", category)

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
        category, 
        deadline: deadline.toString()
      })
    });

    const data = await res.json();
    console.log("🧠 Advisor:", data);

  } catch (err) {
    console.error("❌ Analyze error:", err);
  }
}


// ==========================
// 🟢 HANDLE PROPOSAL EXECUTED
// ==========================
async function handleProposalExecuted(id) {




  console.log("\n🚀 Proposal Executed!");
  console.log("ID:", id.toString());

  try {

    const proposal = await dao.getProposal(id);

    const category = TYPE_MAP[Number(proposal[1])];


    const res = await fetch("http://localhost:8000/process", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        proposal_id: id.toString(),
        description: proposal[0],
        created_by: proposal[7],
        category
      })
    });

    const data = await res.json();
    console.log("🤖 Execution:", data);

  } catch (err) {
    console.error("❌ Execute error:", err);
  }
}


// ==========================
// 🔍 POLLING LOOP
// ==========================
async function pollEvents() {

  while (true) {
    try {

      const currentBlock = await provider.getBlockNumber();

      if (currentBlock >= lastProcessedBlock) {

        console.log(`🔍 Checking blocks ${lastProcessedBlock} → ${currentBlock}`);

        // 🔵 CREATED EVENTS
        const createdEvents = await dao.queryFilter(
          "ProposalCreated",
          lastProcessedBlock,
          currentBlock
        );

        for (const event of createdEvents) {
          const { id, description, proposalType, proposer, deadline } = event.args;

          const category = TYPE_MAP[Number(proposalType)];

          await handleProposalCreated(
            id,
            description,
            category,   // ✅ pass category
            proposer,
            deadline
          );
        }

        // 🟢 EXECUTED EVENTS
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

    } catch (err) {
      console.error("❌ Polling error:", err);
    }

    await new Promise(res => setTimeout(res, POLL_INTERVAL));
  }
}


// ==========================
// ▶️ START LISTENER
// ==========================
async function startListener() {

  console.log("🔄 Connecting to blockchain...");
  console.log("DAO Address:", DAO_ADDRESS);

  provider = new ethers.JsonRpcProvider(RPC_URL);

  dao = new ethers.Contract(
    DAO_ADDRESS,
    DAO_ABI.abi,
    provider
  );

  // ✅ Start from latest block
  lastProcessedBlock = await provider.getBlockNumber();

  console.log("📡 Listener started...");
  console.log("⏳ Polling every 3 seconds...");

  pollEvents();
}


// ==========================
// ▶️ RUN
// ==========================
startListener();

