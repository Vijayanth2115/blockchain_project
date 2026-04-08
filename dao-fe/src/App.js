import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import DAO_ABI from "./DAO.json";
import "./App.css";

const DAO_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const OWNER_NAME  = "Vijayanth";

const PROPOSAL_TYPES = ["💰 Financial","👨‍💻 Hiring","🏛 Governance","⚙ Operational","🔐 Security"];
const PROPOSAL_KEYS  = ["FINANCIAL","HIRING","GOVERNANCE","OPERATIONAL","SECURITY"];

export default function App() {
  const [dao, setDao]                 = useState(null);
  const [account, setAccount]         = useState("");
  const [accountName, setAccountName] = useState("");
  const [isOwner, setIsOwner]         = useState(false);
  const [isMember, setIsMember]       = useState(false);

  const [description, setDescription]   = useState("");
  const [proposalType, setProposalType] = useState(0);

  const [newMember, setNewMember]     = useState("");
  const [memberName, setMemberName]   = useState("");
  const [memberEmail, setMemberEmail] = useState("");

  const [proposals, setProposals]   = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Theme State ──
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("dao-theme") || "dark";
  });

  // Apply theme to <html> and persist
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("dao-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");

  // ── Connect Wallet ──
  const connectWallet = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer   = await provider.getSigner();
      const address  = await signer.getAddress();
      const contract = new ethers.Contract(DAO_ADDRESS, DAO_ABI.abi, signer);

      setDao(contract);
      setAccount(address);

      const ownerAddr = await contract.owner();
      if (ownerAddr.toLowerCase() === address.toLowerCase()) {
        setIsOwner(true);
        setAccountName(OWNER_NAME);
      } else {
        setIsOwner(false);
        try {
          const res  = await fetch(`http://localhost:8000/member/${address}`);
          const data = await res.json();
          setAccountName(data.name || "Unknown");
        } catch { setAccountName("Unknown"); }
      }

      setIsMember(await contract.isMember(address));
      fetchAllProposals(contract);
    } catch (err) { console.error("Wallet error:", err); }
  };

  // ── Add Member ──
  const addMember = async () => {
    if (!newMember || !memberName) return alert("Address and Name required");
    try {
      await (await dao.addMember(newMember)).wait();
      await fetch("http://localhost:8000/add-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: newMember, name: memberName, email: memberEmail })
      });
      setIsMember(await dao.isMember(account));
      setNewMember(""); setMemberName(""); setMemberEmail("");
      alert("Member added");
    } catch (err) { console.error("Add member error:", err.reason || err.message); }
  };

  // ── Create Proposal ──
  const createProposal = async () => {
    if (!description) return alert("Enter description");
    try {
      await (await dao.createProposal(description, proposalType)).wait();
      setDescription("");
      fetchAllProposals();
    } catch (err) { console.error("Create proposal error:", err.reason || err.message); }
  };

  // ── Fetch Proposals ──
  const fetchAllProposals = useCallback(async (daoInstance = dao) => {
    if (!daoInstance) return;
    try {
      const count = Number(await daoInstance.getProposalCount());
      const list  = [];
      for (let i = 0; i < count; i++) {
        const p = await daoInstance.getProposal(i);
        const proposerAddress = p[7];
        let proposerName = "Unknown";
        try {
          const res  = await fetch(`http://localhost:8000/member/${proposerAddress}`);
          const data = await res.json();
          proposerName = data.name || "Unknown";
        } catch {}
        list.push({
          id: i,
          description:     p[0],
          proposer:        proposerName,
          proposerAddress,
          type:            PROPOSAL_KEYS[Number(p[1])],
          typeLabel:       PROPOSAL_TYPES[Number(p[1])],
          yes:             Number(p[2]),
          no:              Number(p[3]),
          executed:        p[4],
          deadline:        new Date(Number(p[6]) * 1000).toLocaleString()
        });
      }
      setProposals(list);
    } catch (err) { console.error("Fetch proposals error:", err); }
  }, [dao]);

  // ── Vote & Execute ──
  const vote = async (id, support) => {
    try { await (await dao.vote(id, support)).wait(); fetchAllProposals(); }
    catch (err) { console.error("Vote error:", err.reason || err.message); }
  };
  const execute = async (id) => {
    try { await (await dao.execute(id)).wait(); fetchAllProposals(); }
    catch (err) { console.error("Execute error:", err.reason || err.message); }
  };

  // ── Auto Refresh ──
  useEffect(() => {
    if (!dao) return;
    const iv = setInterval(fetchAllProposals, 5000);
    return () => clearInterval(iv);
  }, [dao, fetchAllProposals]);

  // ──────────────────────────────────────────────
  //  RENDER
  // ──────────────────────────────────────────────
  return (
    <div id="root">

      {/* ===== NAVBAR ===== */}
      <nav className="navbar">
        {/* hamburger (mobile) */}
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className="hamburger"
          style={{
            background: "transparent", border: "none",
            color: "var(--text-2)", fontSize: 20,
            display: "none",
            padding: "4px 8px", marginRight: 4
          }}
        >☰</button>

        {/* brand */}
        <a className="navbar-brand" href="#">
          <div className="navbar-logo">⚡</div>
          <div>
            <div className="navbar-title">Governance DAO</div>
            <div className="navbar-subtitle">Decentralised Voting</div>
          </div>
        </a>

        <div className="navbar-spacer" />

        {/* network pill */}
        <div className="navbar-net">
          <div className="navbar-net-dot" />
          Localhost · 8545
        </div>

        {/* ── THEME TOGGLE ── */}
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label="Toggle theme"
        >
          {/* track icons */}
          <div className="theme-toggle-track">
            <span className="t-dark">🌙</span>
            <span className="t-light">☀️</span>
          </div>
          {/* sliding knob */}
          <div className="theme-toggle-knob">
            {theme === "dark" ? "🌙" : "☀️"}
          </div>
        </button>

        {/* connect wallet */}
        {!account && (
          <button className="navbar-connect-btn" onClick={connectWallet}>
            Connect Wallet
          </button>
        )}
      </nav>

      {/* ===== SIDEBAR ===== */}
      <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>

        {account && (
          <>
            <div className="sidebar-account" style={{ marginBottom: 8 }}>
              <div className="sidebar-avatar">👤</div>
              <div>
                <div className="sidebar-account-name">{accountName}</div>
                <div className="sidebar-account-addr">
                  {account.slice(0,6)}…{account.slice(-4)}
                </div>
              </div>
            </div>
            <div className="sidebar-roles" style={{ marginBottom: 16 }}>
              {isOwner  && <span className="role-pill owner">Owner</span>}
              {isMember && <span className="role-pill member">Member</span>}
              {!isOwner && !isMember && <span className="role-pill guest">Guest</span>}
            </div>
          </>
        )}

        <span className="sidebar-label">Navigation</span>
        <div className="sidebar-item active">
          <span className="sidebar-item-icon">🗳</span>
          Proposals
          <span className="sidebar-badge">{proposals.length}</span>
        </div>
        {isOwner && (
          <div className="sidebar-item">
            <span className="sidebar-item-icon">➕</span>
            Add Member
          </div>
        )}
        {isMember && (
          <div className="sidebar-item">
            <span className="sidebar-item-icon">📝</span>
            New Proposal
          </div>
        )}

        <span className="sidebar-label" style={{ marginTop: 8 }}>Overview</span>
        <div className="sidebar-item">
          <span className="sidebar-item-icon">📊</span>
          Dashboard
        </div>
        <div className="sidebar-item">
          <span className="sidebar-item-icon">👥</span>
          Members
        </div>
        <div className="sidebar-item">
          <span className="sidebar-item-icon">⚙</span>
          Settings
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-item" style={{ opacity: 0.5, pointerEvents: "none" }}>
            <span className="sidebar-item-icon">🔗</span>
            <span className="mono text-sm text-muted">
              {DAO_ADDRESS.slice(0,6)}…{DAO_ADDRESS.slice(-4)}
            </span>
          </div>
        </div>
      </aside>

      {/* ===== MAIN ===== */}
      <div className="main-wrapper">
        <div className="container">

          {/* Page header */}
          <div className="page-header">
            <h2 className="title">Governance DAO</h2>
            <span className="page-header-meta">
              {proposals.length} proposal{proposals.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Connect prompt */}
          {!account && (
            <div className="card" style={{ textAlign: "center", padding: "40px 24px" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔐</div>
              <p style={{ color: "var(--text-2)", marginBottom: 20, fontSize: 15 }}>
                Connect your wallet to participate in governance
              </p>
              <button onClick={connectWallet} style={{ maxWidth: 240 }}>
                Connect Wallet
              </button>
            </div>
          )}

          {/* Owner panel */}
          {isOwner && (
            <>
              <span className="section-label">Owner Panel</span>
              <div className="card">
                <h3>➕ Add Member</h3>
                <div className="form-grid">
                  <input
                    className="full"
                    placeholder="Wallet address (0x…)"
                    value={newMember}
                    onChange={e => setNewMember(e.target.value)}
                  />
                  <input
                    placeholder="Name"
                    value={memberName}
                    onChange={e => setMemberName(e.target.value)}
                  />
                  <input
                    placeholder="Email"
                    value={memberEmail}
                    onChange={e => setMemberEmail(e.target.value)}
                  />
                </div>
                <button onClick={addMember}>Add Member</button>
              </div>
            </>
          )}

          {/* Create Proposal */}
          {isMember && (
            <>
              <span className="section-label">New Proposal</span>
              <div className="card">
                <h3>📝 Create Proposal</h3>
                <input
                  placeholder="Describe your proposal…"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
                <select onChange={e => setProposalType(Number(e.target.value))}>
                  {PROPOSAL_TYPES.map((t, i) => (
                    <option key={i} value={i}>{t}</option>
                  ))}
                </select>
                <button onClick={createProposal}>Create Proposal</button>
              </div>
            </>
          )}

          {/* Proposals list */}
          {proposals.length > 0 && (
            <span className="section-label">Active Proposals</span>
          )}

          {proposals.map((p, idx) => {
            const total  = p.yes + p.no || 1;
            const yesPct = ((p.yes / total) * 100).toFixed(0);
            return (
              <div key={p.id} className="card" style={{ animationDelay: `${idx * 0.07}s` }}>

                <div className="proposal-type">{p.typeLabel}</div>

                <p className="proposal-title">📌 {p.description}</p>

                <div className="proposer-line">
                  <div className="proposer-avatar">
                    {p.proposer.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="proposer-name">{p.proposer}</div>
                    <div className="proposer-addr">
                      {p.proposerAddress.slice(0,6)}…{p.proposerAddress.slice(-4)}
                    </div>
                  </div>
                </div>

                <div className="vote-bar-wrap">
                  <div className="vote-bar-track">
                    <div className="vote-bar-fill" style={{ width: `${yesPct}%` }} />
                  </div>
                  <div className="vote-stats">
                    <span className="vote-stat yes">✔ YES · {p.yes}</span>
                    <span className="vote-stat no">✘ NO · {p.no}</span>
                  </div>
                </div>

                <div className="deadline-chip">⏳ {p.deadline}</div>

                {!p.executed && isMember && (
                  <div className="vote-actions">
                    <button className="btn-yes"     onClick={() => vote(p.id, true)}>✔ YES</button>
                    <button className="btn-no"      onClick={() => vote(p.id, false)}>✘ NO</button>
                    <button className="btn-execute" onClick={() => execute(p.id)}>▶ Execute</button>
                  </div>
                )}

                {p.executed && (
                  <div className="executed-badge">✅ Executed</div>
                )}
              </div>
            );
          })}

        </div>
      </div>
    </div>
  );
}