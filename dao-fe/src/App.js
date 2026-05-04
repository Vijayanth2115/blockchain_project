import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import DAO_ABI from "./DAO.json";
import "./App.css";

const DAO_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const API_URL = "http://192.168.0.109:8000"; // backend host IP
const OWNER_NAME = "Vijayanth";

const PROPOSAL_TYPES = [
  "💰 Financial",
  "👨‍💻 Hiring",
  "🏛 Governance",
  "⚙ Operational",
  "🔐 Security"
];

const PROPOSAL_KEYS = [
  "FINANCIAL",
  "HIRING",
  "GOVERNANCE",
  "OPERATIONAL",
  "SECURITY"
];

export default function App() {
  const [dao, setDao] = useState(null);
  const [account, setAccount] = useState("");
  const [accountName, setAccountName] = useState("");

  const [isOwner, setIsOwner] = useState(false);
  const [isMember, setIsMember] = useState(false);

  const [proposals, setProposals] = useState([]);
  const [members, setMembers] = useState([]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePage, setActivePage] = useState("dashboard");

  const [description, setDescription] = useState("");
  const [proposalType, setProposalType] = useState(0);

  const [newMember, setNewMember] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");

  const [theme, setTheme] = useState(
    () => localStorage.getItem("dao-theme") || "dark"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("dao-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t) => t === "dark" ? "light" : "dark");
  };


  // =========================
  // CONNECT WALLET
  // =========================

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert("Install MetaMask");
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);

      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      const contract = new ethers.Contract(
        DAO_ADDRESS,
        DAO_ABI.abi,
        signer
      );

      setDao(contract);
      setAccount(address);

      const owner = await contract.owner();

      if (owner.toLowerCase() === address.toLowerCase()) {
        setIsOwner(true);
        setAccountName(OWNER_NAME);
      }
      else {
        setIsOwner(false);

        try {
          const res = await fetch(
            `${API_URL}/member/${address}`
          );

          const data = await res.json();
          setAccountName(data.name || "Unknown");

        } catch {
          setAccountName("Unknown");
        }
      }

      const memberStatus = await contract.isMember(address);
      setIsMember(memberStatus);

      fetchAllProposals(contract);
      fetchMembers();

    } catch (err) {
      console.error(err);
    }
  };


  // =========================
  // FETCH MEMBERS
  // =========================

  const fetchMembers = async () => {
  try{
    const res = await fetch(`${API_URL}/members`);
    const data = await res.json();

    console.log("MEMBERS API:",data);

    setMembers(data.members || []);
  }
  catch(err){
    console.error("Members fetch failed:",err);
  }
  };


  // =========================
  // ADD MEMBER
  // =========================

  const addMember = async () => {

    if(!newMember || !memberName){
      return alert("Address + name required");
    }

    try {
      await (
        await dao.addMember(newMember)
      ).wait();

      await fetch(
        `${API_URL}/add-member`,
        {
          method:"POST",
          headers:{
            "Content-Type":"application/json"
          },
          body: JSON.stringify({
            address:newMember,
            name:memberName,
            email:memberEmail
          })
        }
      );

      setNewMember("");
      setMemberName("");
      setMemberEmail("");

      fetchMembers();

      alert("Member added");

    } catch(err){
      console.error(err);
    }
  };


  // =========================
  // CREATE PROPOSAL
  // =========================

  const createProposal = async () => {

    if(!description){
      return alert("Enter proposal");
    }

    try{

      await (
        await dao.createProposal(
          description,
          proposalType
        )
      ).wait();

      setDescription("");
      fetchAllProposals();
      setActivePage("dashboard");

    } catch(err){
      console.error(err);
    }
  };


  // =========================
  // FETCH PROPOSALS
  // =========================

  const fetchAllProposals = useCallback(
  async (daoInstance=dao)=>{

    if(!daoInstance) return;

    try{
      const count = Number(
        await daoInstance.getProposalCount()
      );

      const list=[];

      for(let i=0;i<count;i++){

        const p=await daoInstance.getProposal(i);

        let proposerName="Unknown";

        try{
          const res = await fetch(
            `${API_URL}/member/${p[7]}`
          );

          const data = await res.json();
          proposerName = data.name || "Unknown";
        }
        catch{}

        list.push({
          id:i,
          description:p[0],
          proposer:proposerName,
          proposerAddress:p[7],
          typeLabel:
             PROPOSAL_TYPES[
                Number(p[1])
             ],
          type:
             PROPOSAL_KEYS[
                Number(p[1])
             ],
          yes:Number(p[2]),
          no:Number(p[3]),
          executed:p[4],
          deadline:
            new Date(
             Number(p[6])*1000
            ).toLocaleString()
        });
      }

      setProposals(list);

    } catch(err){
      console.error(err);
    }

  },[dao]);


  // =========================
  // VOTE
  // =========================

  const vote = async(id,support)=>{
    try{
      await (
       await dao.vote(id,support)
      ).wait();

      fetchAllProposals();

    }catch(err){
      console.error(err);
    }
  };


  // =========================
  // EXECUTE
  // =========================

  const execute = async(id)=>{
    try{
      await (
        await dao.execute(id)
      ).wait();

      fetchAllProposals();

    }catch(err){
      console.error(err);
    }
  };


  useEffect(()=>{
    if(!dao) return;

    const iv = setInterval(
      fetchAllProposals,
      5000
    );

    return ()=>clearInterval(iv);

  },[dao,fetchAllProposals]);


  // =========================
  // RENDER
  // =========================

  return (
<div id="root">

<nav className="navbar">

<button
className="hamburger"
onClick={()=>setSidebarOpen(!sidebarOpen)}
>
☰
</button>

<a className="navbar-brand" href="#">
<div className="navbar-logo">
⚡
</div>
<div>
<div className="navbar-title">
Governance DAO
</div>
<div className="navbar-subtitle">
Decentralised Voting
</div>
</div>
</a>

<div className="navbar-spacer" />

<div className="navbar-net">
<div className="navbar-net-dot" />
Localhost · 8545
</div>

<button
className="theme-toggle"
onClick={toggleTheme}
>
{theme==="dark"?"🌙":"☀️"}
</button>

{!account && (
<button
className="navbar-connect-btn"
onClick={connectWallet}
>
Connect Wallet
</button>
)}

</nav>


<aside className={`sidebar ${sidebarOpen?"open":""}`}>

{account && (
<>
<div className="sidebar-account">
<div className="sidebar-avatar">
👤
</div>
<div>
<div className="sidebar-account-name">
{accountName}
</div>
<div className="sidebar-account-addr">
{account.slice(0,6)}…{account.slice(-4)}
</div>
</div>
</div>

<div className="sidebar-roles">
{isOwner &&
<span className="role-pill owner">
Owner
</span>}

{isMember &&
<span className="role-pill member">
Member
</span>}
</div>
</>
)}


<div
className={`sidebar-item ${activePage==="dashboard"?"active":""}`}
onClick={()=>setActivePage("dashboard")}
>
📊 Dashboard
<span className="sidebar-badge">
{proposals.length}
</span>
</div>


{isOwner && (
<div
className={`sidebar-item ${activePage==="add-member"?"active":""}`}
onClick={()=>setActivePage("add-member")}
>
➕ Add Member
</div>
)}


{isMember && (
<div
className={`sidebar-item ${activePage==="proposal"?"active":""}`}
onClick={()=>setActivePage("proposal")}
>
📝 Create Proposal
</div>
)}


<div
className={`sidebar-item ${activePage==="members"?"active":""}`}
onClick={()=>{
 setActivePage("members");
 fetchMembers();
}}
>
👥 Members
<span className="sidebar-badge">
{members.length}
</span>
</div>


<div
className={`sidebar-item ${activePage==="settings"?"active":""}`}
onClick={()=>setActivePage("settings")}
>
⚙ Settings
</div>


<div className="sidebar-bottom">
<div className="sidebar-item">
🔗
{DAO_ADDRESS.slice(0,6)}...
</div>
</div>

</aside>


<div className="main-wrapper">
<div className="container">

<div className="page-header">
<h2 className="title">
Governance DAO
</h2>
</div>


{!account && (
<div className="card">
<h3>
Connect wallet to continue
</h3>
</div>
)}


{/* DASHBOARD */}
{activePage==="dashboard" && (
<>
<span className="section-label">
Active Proposals
</span>

{proposals.map((p,idx)=>{

const total = p.yes+p.no ||1;
const yesPct=(p.yes/total)*100;

return(
<div
key={p.id}
className="card"
style={{animationDelay:`${idx*.05}s`}}
>

<div className="proposal-type">
{p.typeLabel}
</div>

<p className="proposal-title">
📌 {p.description}
</p>

<div className="proposer-line">
<div className="proposer-avatar">
{p.proposer[0]}
</div>
<div>
<div className="proposer-name">
{p.proposer}
</div>
<div className="proposer-addr">
{p.proposerAddress}
</div>
</div>
</div>

<div className="vote-bar-track">
<div
className="vote-bar-fill"
style={{width:`${yesPct}%`}}
/>
</div>

<div className="vote-stats">
<span>
YES {p.yes}
</span>
<span>
NO {p.no}
</span>
</div>

<div className="deadline-chip">
⏳ {p.deadline}
</div>

{!p.executed && isMember && (
<div className="vote-actions">
<button
className="btn-yes"
onClick={()=>vote(p.id,true)}
>
Vote Yes
</button>

<button
className="btn-no"
onClick={()=>vote(p.id,false)}
>
Vote No
</button>

<button
className="btn-execute"
onClick={()=>execute(p.id)}
>
Execute
</button>
</div>
)}

{p.executed && (
<div className="executed-badge">
Executed
</div>
)}

</div>
)
})}
</>
)}


{/* ADD MEMBER */}
{activePage==="add-member" && isOwner && (
<div className="card">
<h3>Add Member</h3>

<div className="form-grid">

<input
placeholder="wallet"
value={newMember}
onChange={(e)=>setNewMember(e.target.value)}
/>

<input
placeholder="name"
value={memberName}
onChange={(e)=>setMemberName(e.target.value)}
/>

<input
placeholder="email"
value={memberEmail}
onChange={(e)=>setMemberEmail(e.target.value)}
/>

</div>

<button onClick={addMember}>
Add Member
</button>
</div>
)}


{/* CREATE PROPOSAL */}
{activePage==="proposal" && isMember && (
<div className="card">
<h3>Create Proposal</h3>

<input
placeholder="Proposal description"
value={description}
onChange={(e)=>setDescription(e.target.value)}
/>

<select
value={proposalType}
onChange={(e)=>
setProposalType(
Number(e.target.value)
)}
>
{PROPOSAL_TYPES.map((t,i)=>(
<option key={i} value={i}>
{t}
</option>
))}
</select>

<button onClick={createProposal}>
Submit Proposal
</button>

</div>
)}


{/* MEMBERS */}
{activePage==="members" && (
<div className="card">
<h3>DAO Members</h3>

<div className="members-grid">

{members.length===0 ? (
<p>No members found</p>
) : members.map((m,i)=>(
<div
key={i}
className="member-card"
>
<div className="member-avatar">
{m.name?.[0]||"M"}
</div>

<div>
<h4>{m.name}</h4>
<p>{m.address}</p>
<small>{m.email}</small>
</div>

</div>
))}

</div>
</div>
)}


{/* SETTINGS */}
{activePage==="settings" && (
<div className="card">
<h3>Settings</h3>

<button onClick={toggleTheme}>
Toggle Theme
</button>

</div>
)}


</div>
</div>

</div>
  );
}