// require("@nomiclabs/hardhat-ethers");

// /** @type import('hardhat/config').HardhatUserConfig */
// module.exports = {
//   solidity: "0.8.28",
// };

require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: "0.8.28",
  networks: {
    sepolia: {
      url: "https://eth-sepolia.g.alchemy.com/v2/uQDE50i5QGTmunM7Izkw_",
      accounts: [
        "9b5da320047d47a0f88287bbc08e0cab427b11ac17425fc25dbb785b7fecb669"
      ]
    }
  }
};
