const hre = require("hardhat");

async function main() {
  const [owner, member1, member2] = await hre.ethers.getSigners();

  console.log("Owner:", owner.address);
  console.log("Member1:", member1.address);
  console.log("Member2:", member2.address);

  // Replace with latest deployed address
  const DAO_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  const DAO = await hre.ethers.getContractFactory("DAO");
  const dao = DAO.attach(DAO_ADDRESS);

  // Add members
  await dao.addMember(member1.address);
  await dao.addMember(member2.address);
  console.log("Members added");

  // Create proposal
  await dao.createProposal(
    "Hire backend engineers",
    1 // ProposalType.HIRING
  );
  console.log("Proposal created");

  // Vote
  await dao.connect(member1).vote(0);
  await dao.connect(member2).vote(0);
  console.log("Votes cast");

  // Execute
  await dao.execute(0);
  console.log("Proposal executed");

  // ✅ READ USING EXPLICIT GETTER (IMPORTANT)
  const proposal = await dao.getProposal(0);

  console.log("\nFinal Proposal State:");
  console.log("Description:", proposal.description);
  console.log("Type:", proposal.proposalType.toString());
  console.log("Votes:", proposal.voteCount.toString());
  console.log("Executed:", proposal.executed);
  console.log("Created At:", proposal.createdAt.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
