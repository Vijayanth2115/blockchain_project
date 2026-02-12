const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying DAO with account:", deployer.address);

  const quorum = 2;

  const DAO = await hre.ethers.getContractFactory("DAO");
  const dao = await DAO.deploy(quorum);

  await dao.deployed();

  console.log("DAO deployed to:", dao.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
