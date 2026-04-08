from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
from dao_mcp import route_proposal, proposal_advisor
import uvicorn
import sqlite3
import os
import aiosmtplib
from email.message import EmailMessage

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


DB_PATH = "dao_system.db"


# =========================
# 🧱 INIT DB (NEW)
# =========================
def init_db():

    # 🔄 Reset DB (dev mode)
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    print("🧹 DB RESET CALLED")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # =========================
    # 👤 MEMBERS
    # =========================
    cursor.execute("""
    CREATE TABLE members (
        address TEXT PRIMARY KEY,
        name TEXT,
        email TEXT
    )
    """)

    # =========================
    # 💰 TREASURY
    # =========================
    cursor.execute("""
    CREATE TABLE treasury (
        id INTEGER PRIMARY KEY,
        total_balance INTEGER,
        reserves INTEGER
    )
    """)

    # =========================
    # 📊 PROJECTS
    # =========================
    cursor.execute("""
    CREATE TABLE projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        budget INTEGER,
        status TEXT
    )
    """)

    # =========================
    # 📒 LEDGER
    # =========================
    cursor.execute("""
    CREATE TABLE ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        proposal TEXT,
        amount INTEGER,
        category TEXT,
        timestamp TEXT
    )
    """)

    # =========================
    # 🌱 INITIAL DATA
    # =========================

    # Owner
    cursor.execute("""
    INSERT INTO members (address, name, email)
    VALUES (?, ?, ?)
    """, (
        "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
        "Vijayanth",
        "vijayanth.karri2005@gmail.com"
    ))

    # Treasury
    cursor.execute("""
    INSERT INTO treasury (id, total_balance, reserves)
    VALUES (1, 50000000, 10000000)
    """)

    conn.commit()
    conn.close()


init_db()


async def send_email(to_email, subject, body):

    msg = EmailMessage()
    msg["From"] = "your_email@gmail.com"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    await aiosmtplib.send(
        msg,
        hostname="smtp.gmail.com",
        port=587,
        start_tls=True,
        username="vijayanthvenkat96@gmail.com",
        password="plsn tsth iidd gxik"  # 🔥 not normal password
    )

def get_all_members():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT name, email FROM members")
    members = cursor.fetchall()

    conn.close()
    return members


@app.post("/process")
async def process(p: dict):

    description = p.get("description")
    created_by = p.get("created_by")
    proposal_id = p.get("proposal_id")

    if not description:
        return {"error": "No description provided"}

    print("\n📥 Received proposal:", description)

    # =========================
    # 🧠 STEP 1: AI ADVISOR
    # =========================
    advisor_result = proposal_advisor(
            description=description,
            created_by=created_by,
            proposal_id=proposal_id
        )

    analysis = advisor_result.get("analysis", {})

    # =========================
    # 🚀 STEP 2: ROUTER
    # =========================
    result = route_proposal(description, analysis)

    print("⚙️ Execution processed:", result)

    # =========================
    # 📤 RESPONSE
    # =========================
    return {
        "advisor": advisor_result,
        "execution": result
    }



@app.post("/analyze")
async def analyze(p: dict):

    description = p.get("description")
    created_by = p.get("created_by")
    proposal_id = p.get("proposal_id")

    if not description:
        return {"error": "No description provided"}

    print("\n📥 Advisor received proposal:")
    print("Description:", description)
    print("Created by:", created_by)

    # =========================
    # 🧠 AI ANALYSIS
    # =========================
    try:
        result = proposal_advisor(
            description=description,
            created_by=created_by,
            proposal_id=proposal_id
        )
    except Exception as e:
        print("❌ Advisor failed:", e)
        result = {
            "analysis": {
                "category": "unknown",
                "risk": "unknown",
                "recommendation": "AI analysis failed"
            }
        }

    # =========================
    # 👤 GET CREATOR NAME
    # =========================
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute(
        "SELECT name FROM members WHERE LOWER(address)=LOWER(?)",
        (created_by,)
    )

    row = cursor.fetchone()
    creator_name = row[0] if row else "Unknown"

    conn.close()

    # =========================
    # 📊 SAFE ANALYSIS EXTRACTION
    # =========================
    analysis = result.get("analysis", {})

    category = analysis.get("category", "N/A")
    risk = analysis.get("risk", "N/A")
    recommendation = analysis.get("recommendation", "N/A")

    # =========================
    # 📩 EMAIL CONTENT
    # =========================
    subject = f"🗳 New DAO Proposal by {creator_name}"

    body = f"""
📢 New Proposal Created

👤 Created by: {creator_name}

📝 Description:
{description}

🧠 AI Analysis:
- Category: {category}
- Risk: {risk}
- Recommendation: {recommendation}

👉 Please login and cast your vote.
"""

    # =========================
    # 📤 SEND EMAILS
    # =========================
    members = get_all_members()

    for name, email in members:
        if not email:
            continue

        try:
            await send_email(email, subject, body)
            print(f"📧 Email sent to {name} ({email})")
        except Exception as e:
            print(f"❌ Email failed for {name} ({email}):", e)

    print("\n==============================")
    print("🧠 FINAL AI ANALYSIS")
    print(result)
    print("==============================\n")

    return {
        "created_by": creator_name,   # ✅ name instead of address
        "proposal": description,
        "analysis": analysis
    }


# =========================
# 👤 ADD MEMBER (NEW)
# =========================
@app.post("/add-member")
async def add_member(data: dict):

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
    INSERT OR REPLACE INTO members (address, name, email)
    VALUES (?, ?, ?)
    """, (
        data.get("address").lower(),
        data.get("name"),
        data.get("email")
    ))

    conn.commit()
    conn.close()

    return {"status": "member added"}


# =========================
# 🔍 GET MEMBER NAME (NEW)
# =========================
@app.get("/member/{address}")
async def get_member(address: str):

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # cursor.execute("SELECT name FROM members WHERE address=?", (address,))
    cursor.execute(
    "SELECT name FROM members WHERE LOWER(address)=LOWER(?)",
    (address,)
)
    row = cursor.fetchone()

    conn.close()

    if row:
        return {"name": row[0]}
    else:
        return {"name": "Unknown"}


# =========================
# 🚀 RUN SERVER
# =========================
if __name__ == "__main__":
    print("🌉 MCP Bridge running...")
    uvicorn.run(app, host="0.0.0.0", port=8000)