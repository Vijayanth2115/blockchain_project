import { useState } from "react";
import { ethers } from "ethers";
import DAO_ABI from "./DAO.json";

const DAO_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

function App() {
  const [dao, setDao] = useState(null);
  const [account, setAccount] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [description, setDescription] = useState("");
  const [proposalType, setProposalType] = useState(0);
  const [newMember, setNewMember] = useState("");
  const [proposals, setProposals] = useState([]);

  const connectWallet = async () => {
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();

    const daoContract = new ethers.Contract(
      DAO_ADDRESS,
      DAO_ABI.abi,
      signer
    );

    setDao(daoContract);
    setAccount(address);

    setIsOwner((await daoContract.owner()).toLowerCase() === address.toLowerCase());
    setIsMember(await daoContract.isMember(address));

    fetchAllProposals(daoContract);
  };

  const addMember = async () => {
    await (await dao.addMember(newMember)).wait();
    alert("Member added");
  };

  const createProposal = async () => {
    await (await dao.createProposal(description, proposalType)).wait();
    setDescription("");
    fetchAllProposals();
  };

  // const fetchAllProposals = async (daoInstance = dao) => {
  //   const count = Number(await daoInstance.getProposalCount());
  //   let list = [];

  //   for (let i = 0; i < count; i++) {
  //     const p = await daoInstance.getProposal(i);
  //     list.push({
  //       id: i,
  //       description: p[0],
  //       type: ["FINANCIAL","HIRING","GOVERNANCE","OPERATIONAL","SECURITY"][p[1]],
  //       yes: p[2].toString(),
  //       no: p[3].toString(),
  //       executed: p[4],
  //       created: new Date(Number(p[5]) * 1000).toLocaleString(),
  //       deadline: new Date(Number(p[6]) * 1000).toLocaleString()
  //     });
  //   }
  //   setProposals(list);
  // };

  const fetchAllProposals = async (daoInstance = dao) => {
    if (!daoInstance) return;

    const count = Number(await daoInstance.getProposalCount());
    let list = [];

    for (let i = 0; i < count; i++) {
      const p = await daoInstance.getProposal(i);

      list.push({
        id: i,
        description: p[0],
        type: ["FINANCIAL","HIRING","GOVERNANCE","OPERATIONAL","SECURITY"][Number(p[1])],
        yes: Number(p[2]),
        no: Number(p[3]),
        executed: p[4],
        created: new Date(Number(p[5]) * 1000).toLocaleString(),
        deadline: new Date(Number(p[6]) * 1000).toLocaleString()
      });
    }

    setProposals(list);
  };


  const vote = async (id, support) => {
    await (await dao.vote(id, support)).wait();
    fetchAllProposals();
  };

  const execute = async (id) => {
    await (await dao.execute(id)).wait();
    fetchAllProposals();
  };

  return (
    <div style={{ padding: 40 }}>
      <h2>Governance DAO</h2>

      {!account ? (
        <button onClick={connectWallet}>Connect Wallet</button>
      ) : (
        <>
          <p>Account: {account}</p>
          <p>Owner: {isOwner ? "Yes" : "No"}</p>
          <p>Member: {isMember ? "Yes" : "No"}</p>
        </>
      )}

      {isOwner && (
        <>
          <input placeholder="Member address" onChange={e => setNewMember(e.target.value)} />
          <button onClick={addMember}>Add Member</button>
        </>
      )}

      {isMember && (
        <>
          <input placeholder="Proposal description" value={description} onChange={e => setDescription(e.target.value)} />
          <select onChange={e => setProposalType(Number(e.target.value))}>
            <option value="0">Financial</option>
            <option value="1">Hiring</option>
            <option value="2">Governance</option>
            <option value="3">Operational</option>
            <option value="4">Security</option>
          </select>
          <button onClick={createProposal}>Create</button>
        </>
      )}

      <hr />

      {proposals.map(p => (
        <div key={p.id} style={{ border: "1px solid gray", padding: 10 }}>
          <p>{p.description}</p>
          <p>YES: {p.yes} | NO: {p.no}</p>
          <p>Deadline: {p.deadline}</p>
          {!p.executed && isMember && (
            <>
              <button onClick={() => vote(p.id, true)}>YES</button>
              <button onClick={() => vote(p.id, false)}>NO</button>
            </>
          )}
          {!p.executed && <button onClick={() => execute(p.id)}>Execute</button>}
        </div>
      ))}
    </div>
  );
}

export default App;
