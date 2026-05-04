from fastmcp import FastMCP
from google import genai
import sqlite3
import datetime
import re
import requests
import json
import smtplib
from email.mime.text import MIMEText
import time
import smtplib
from dotenv import load_dotenv
load_dotenv()
import os

AUX_DB="dao.db"

def reset_aux_db():
    if os.path.exists(AUX_DB):
        os.remove(AUX_DB)
        print("🧹 dao.db reset")



# 🔑 Gemini API
client = genai.Client(api_key="AIzaSyBT9VIMwdcSvmrnMZFSCvc5Az7caE-vV1Y")
client_secondary = genai.Client(api_key="AIzaSyANJqosjouYiHqqrwUHvh0vBzHxiw_v7JE")

mcp = FastMCP("DAO AI MCP Server")

DB_PATH = "dao_system.db"


# =========================
# 🧱 DATABASE INIT
# =========================

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS treasury (
        id INTEGER PRIMARY KEY,
        total_balance INTEGER,
        reserves INTEGER,
        last_updated TEXT
    )
    """)

    cursor.execute("SELECT COUNT(*) FROM treasury")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
        INSERT INTO treasury (id, total_balance, reserves, last_updated)
        VALUES (1, 50000000, 10000000, ?)
        """, (datetime.datetime.now(),))

    conn.commit()
    conn.close()


def seed_data():
    pass


# =========================
# 📊 DB SUMMARY (SAFE)
# =========================

def get_db_summary():

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT total_balance, reserves FROM treasury WHERE id=1")
    treasury = cursor.fetchone()

    conn.close()

    if treasury:
        balance = treasury[0]
        reserves = treasury[1]
    else:
        balance = 0
        reserves = 0

    return f"""
DAO Financial State:
- Treasury Balance: {balance}
- Reserves: {reserves}
"""



@mcp.tool()
def proposal_advisor(description: str, created_by: str = None, proposal_id: str = None, category: str = None):

    import json
    import re

    print("\n📥 Advisor received proposal:")
    print("Description:", description)
    print("Created by:", created_by)
    print("Category (from blockchain):", category)

    db_summary = get_db_summary()

    # =========================
    # 🧠 SIMPLE PROMPT (NO CATEGORY)
    # =========================
    prompt = f"""
You are an AI advisor for a DAO.

Analyze the proposal using the DAO's financial context.

{db_summary}

Proposal:
{description}


category :
{category}


Return STRICT JSON ONLY:

{{
  "risk": "<low | medium | high>",
  "financial_impact": "<short explanation>",
  "feasibility": "<short explanation>",
  "insights": "<key insights>",
  "recommendation": "<approve | reject | modify>"
}}

Rules:
- NO markdown
- NO extra text
- ONLY JSON
"""

    try:
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=prompt
        )

        raw_text = response.text.strip()

        print("\n🧠 Raw LLM response:")
        print(raw_text)

        # =========================
        # 🔥 CLEAN RESPONSE
        # =========================
        cleaned = re.sub(r"```json|```", "", raw_text).strip()

        # =========================
        # 🔥 SAFE JSON PARSING
        # =========================
        try:
            analysis = json.loads(cleaned)
        except Exception as e:
            print("⚠️ JSON parse failed:", e)

            match = re.search(r"\{.*\}", cleaned, re.DOTALL)

            if match:
                try:
                    analysis = json.loads(match.group())
                except:
                    analysis = fallback_analysis(cleaned)
            else:
                analysis = fallback_analysis(cleaned)

    except Exception as e:
        print("❌ Gemini API error:", e)

        analysis = fallback_analysis(str(e))

    # =========================
    # 🔥 FORCE CATEGORY (MOST IMPORTANT)
    # =========================
    analysis["category"] = category

    result = {
        "created_by": created_by,
        "proposal": description,
        "analysis": analysis
    }

    print("\n==============================")
    print("🧠 FINAL AI ANALYSIS")
    print(json.dumps(result, indent=2))
    print("==============================\n")

    return result


# =========================
# 🔥 SIMPLE FALLBACK
# =========================
# def fallback_analysis(raw_text):

#     return {
#         "risk": "unknown",
#         "financial_impact": "unknown",
#         "feasibility": "unknown",
#         "insights": "Fallback analysis used",
#         "recommendation": raw_text[:200]
#     }


# =========================
# 🔥 FALLBACK HELPERS
# =========================
def fallback_category(description):
    desc = description.lower()

    if "quorum" in desc or "vote" in desc:
        return "governance"
    elif "hire" in desc:
        return "hiring"
    elif "budget" in desc or "fund" in desc or "money" in desc:
        return "financial"
    elif "access" in desc or "security" in desc:
        return "security"
    else:
        return "operational"


def fallback_analysis(description, raw):
    return {
        "category": fallback_category(description),
        "risk": "unknown",
        "financial_impact": "unknown",
        "feasibility": "unknown",
        "insights": "Fallback analysis used",
        "recommendation": raw
    }



@mcp.tool()
def financial_action(details: str) -> dict:

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # =========================
    # 💰 GET TREASURY
    # =========================
    cursor.execute("SELECT total_balance, reserves FROM treasury WHERE id=1")
    row = cursor.fetchone()

    if not row:
        return {"error": "Treasury not initialized"}

    balance, reserves = row

    # =========================
    # 🔍 EXTRACT AMOUNT
    # =========================
    amount_match = re.search(r"\d+", details.replace(",", ""))

    if not amount_match:
        return {"error": "No amount found in proposal"}

    amount = int(amount_match.group())

    details_lower = details.lower()

    # =========================
    # 🟢 CASE 1 — ALLOCATE FUNDS
    # =========================
    if "allocate" in details_lower or "project" in details_lower:

        if balance < amount:
            return {
                "tool": "financial",
                "status": "rejected",
                "reason": "Insufficient funds"
            }

        new_balance = balance - amount

        # Update treasury
        cursor.execute("""
        UPDATE treasury SET total_balance=? WHERE id=1
        """, (new_balance,))

        # Add project
        cursor.execute("""
        INSERT INTO projects (name, budget, status)
        VALUES (?, ?, ?)
        """, (details, amount, "active"))

        action = "funds_allocated"

    # =========================
    # 🟡 CASE 2 — ADD FUNDS
    # =========================
    elif "add" in details_lower or "increase" in details_lower:

        new_balance = balance + amount

        cursor.execute("""
        UPDATE treasury SET total_balance=? WHERE id=1
        """, (new_balance,))

        action = "funds_added"

    # =========================
    # 🔵 CASE 3 — RESERVES
    # =========================
    elif "reserve" in details_lower:

        if balance < amount:
            return {
                "tool": "financial",
                "status": "rejected",
                "reason": "Not enough balance to move to reserves"
            }

        new_balance = balance - amount
        new_reserves = reserves + amount

        cursor.execute("""
        UPDATE treasury SET total_balance=?, reserves=? WHERE id=1
        """, (new_balance, new_reserves))

        action = "reserves_updated"

    # =========================
    # ❌ UNKNOWN
    # =========================
    else:
        return {
            "tool": "financial",
            "status": "unknown_action",
            "message": "Could not determine financial action"
        }

    # =========================
    # 📒 LEDGER ENTRY
    # =========================
    cursor.execute("""
    INSERT INTO ledger (proposal, amount, category, timestamp)
    VALUES (?, ?, ?, ?)
    """, (
        details,
        amount,
        "financial",
        datetime.datetime.now()
    ))

    conn.commit()
    conn.close()

    return {
        "tool": "financial",
        "status": action,
        "amount": amount,
        "new_balance": new_balance
    }


# =========================
# 📩 TELEGRAM FUNCTION
# =========================
def send_telegram(message):

    BOT_TOKEN = "8666766566:AAHPaM0H5PuMPlsAitTjrKUaZgSQqu3B89s"
    CHAT_ID = "-1003702720370"   

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"

    try:
        response = requests.post(url, json={
            "chat_id": CHAT_ID,
            "text": message,
            # "parse_mode": "Markdown"   # ✅ formatting
        })

        if response.status_code != 200:
            print("❌ Telegram Error:", response.text)

    except Exception as e:
        print("❌ Telegram send failed:", e)




# =========================
# 🧑‍💼 HIRING TOOL (FIXED)
# =========================

CANDIDATES = [
    {"name": "blockmail", "email": "blockchain42project@gmail.com"},
    {"name": "venkatf", "email": "vijayanthvenkatf@gmail.com"},
    {"name": "venkatw", "email": "vijayanthvenkatw@gmail.com"}
]

import smtplib
from email.message import EmailMessage
import os

def send_email(to_email, subject, body):

    msg = EmailMessage()
    msg["From"] = os.getenv("EMAIL_USER")
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

 
    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(os.getenv("EMAIL_USER"), os.getenv("EMAIL_PASS"))
        server.send_message(msg)

def send_hiring_emails(subject, body):

    for person in CANDIDATES:
        name = person.get("name")
        email = person.get("email")

        if not email:
            continue

        try:
            send_email(email, subject, body)
            print(f"📧 Email sent to {name} ({email})")

        except Exception as e:
            print(f"❌ Failed for {name} ({email}):", e)





@mcp.tool()
def hiring_action(details: str) -> dict:

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    details_lower = details.lower()

    # =========================
    # 🔍 EXTRACT ROLE + COUNT
    # =========================
    import re

    count_match = re.search(r"\d+", details)
    count = int(count_match.group()) if count_match else 1

    ROLE_KEYWORDS = {
    "Backend Engineer": ["backend", "api", "server"],
    "Frontend Engineer": ["frontend", "ui", "react", "web"],
    "AI Engineer": ["ai", "machine learning", "ml"],
    "Data Scientist": ["data scientist", "analytics", "data"],
    "Blockchain Developer": ["blockchain", "web3", "solidity"],
    "DevOps Engineer": ["devops", "ci/cd", "deployment"],
    "Mobile Developer": ["android", "ios", "mobile"],
    "Full Stack Developer": ["full stack", "fullstack"],
    "QA Engineer": ["testing", "qa", "quality"],
    "Product Manager": ["product manager", "pm"],
    "Designer": ["ui/ux", "designer", "ux"]
    }


    def detect_role(details: str) -> str:

        details_lower = details.lower()

        for role, keywords in ROLE_KEYWORDS.items():
            for keyword in keywords:
                if keyword in details_lower:
                    return role

        return "Engineer"  # fallback


    role = detect_role(details)

    
    # =========================
    # 🤖 PROMPT (MISSING BEFORE)
    # =========================
    prompt = f"""
Create a concise job description in STRICTLY 30-40 words.

Role: {role}
Number of positions: {count}

Include:
- Key responsibilities
- Required skills

Keep it short, clear, and professional.
NO bullet points.
NO formatting.
"""

    # =========================
    # 🤖 GENERATE JD (RETRY + FALLBACK)
    # =========================
    job_description = ""

    import time

    for attempt in range(3):
        try:
            response = client_secondary.models.generate_content(
                model="gemini-3-flash-preview",
                contents=prompt
            )
            job_description = response.text.strip()
            job_description = " ".join(job_description.split()[:40])
            break

        except Exception as e:
            print(f"⚠️ Gemini attempt {attempt+1} failed:", e)

            if attempt == 2:
                # ✅ fallback
                job_description = f"""
Role: {role}

We are hiring {count} {role}(s).

Responsibilities:
- Build scalable systems
- Work with team members
- Deliver high-quality code

Required Skills:
- Strong fundamentals
- Problem-solving skills

Location: Remote
"""
            else:
                time.sleep(2)

    # =========================
    # 💾 STORE IN DB
    # =========================
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS hiring (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT,
        count INTEGER,
        description TEXT,
        created_at TEXT
    )
    """)

    cursor.execute("""
    INSERT INTO hiring (role, count, description, created_at)
    VALUES (?, ?, ?, ?)
    """, (
        role,
        count,
        job_description,
        datetime.datetime.now()
    ))

    conn.commit()
    conn.close()

    # =========================
    # 📩 TELEGRAM MESSAGE
    # =========================
    telegram_message = f"""
🚀 *New Hiring Opportunity*

👨‍💻 *Role:* {role}  
📌 *Openings:* {count}  

📝 *Job Description:*  
{job_description[:800]}...

👉 Apply now or reach out!
"""

    # =========================
    # 📤 SEND TELEGRAM
    # =========================
    send_telegram(telegram_message)

    print("📢 Hiring posted to Telegram")


# hiring emails 

    apply_link = "A&BC.com"

    subject = f"🚀 Hiring: {role}"

    email_body = f"""
    Hello,

    We are excited to announce a new opportunity!

    Role: {role}
    Openings: {count}

    Job Description:
    {job_description}

    Apply here:
    {apply_link}

    Best regards,
    DAO Team
    """

    # ✅ CALL THIS
    send_hiring_emails(subject, email_body)

    return {
        "tool": "hiring",
        "status": "job_created_and_posted",
        "role": role,
        "count": count,
        "job_description": job_description
    }


# =========================
# 🔁 GEMINI RETRY (2 API KEYS SUPPORTED)
# =========================
def call_gemini_with_retry(prompt, retries=3):

    for i in range(retries):
        try:
            print(f"🔵 Gemini call attempt {i+1}")

            response = client_secondary.models.generate_content(
                model="gemini-3-flash-preview",   
                contents=prompt
            )

            if response and response.text:
                return response

        except Exception as e:
            if "503" in str(e):
                print(f"⚠️ Retry {i+1} due to overload...")
                time.sleep(2)
            else:
                raise e

    print("⚠️ Gemini failed, using fallback email")
    return None


# =========================
# 🏛 GOVERNANCE TOOL
# =========================
@mcp.tool()
def governance_action(details: str):
    """
    Governance tool (NO AI, only DB + structured email)
    """

    import sqlite3
    import datetime
    import smtplib
    from email.mime.text import MIMEText

    try:
        print("\n⚙️ Governance tool triggered")
        print("Proposal:", details)

        category = "governance"
        action_type = "FUTURE_UPDATE"
        priority = "medium"

        # =========================
        # 🗄️ STORE IN DB
        # =========================
        conn = sqlite3.connect("dao.db")
        cursor = conn.cursor()

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS governance_changes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            proposal TEXT,
            category TEXT,
            action_type TEXT,
            priority TEXT,
            created_at TEXT
        )
        """)

        cursor.execute("""
        INSERT INTO governance_changes
        (proposal, category, action_type, priority, created_at)
        VALUES (?, ?, ?, ?, ?)
        """, (
            details,
            category,
            action_type,
            priority,
            datetime.datetime.now().isoformat()
        ))

        conn.commit()
        conn.close()

        print("🗄️ Governance change stored in DB")

        # =========================
        # 📧 STRUCTURED EMAIL
        # =========================
        email_text = f"""
📢 DAO Governance Proposal

Proposal:
{details}

Category:
Governance

Action Type:
Future Update Required

Details:
This proposal requires changes to DAO rules or configuration.
These changes should NOT be applied immediately.

Next Steps:
- Review proposal carefully
- Plan required contract/backend updates
- Implement in next system version

Priority:
Medium
"""

        msg = MIMEText(email_text)

        msg["Subject"] = "DAO Governance Action Required"
        msg["From"] = "vijayanthvenkat96@gmail.com"
        msg["To"] = "blockchain42project@gmail.com"

        try:
            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
                server.login("vijayanthvenkat96@gmail.com", "plsntsthiiddgxik")
                server.send_message(msg)

            print("📧 Governance email sent")

        except Exception as e:
            print("⚠️ Email failed:", e)

        # =========================
        # ✅ RETURN RESULT
        # =========================
        return {
            "tool": "governance",
            "status": "processed",
            "stored": True,
            "email_sent": True
        }

    except Exception as e:
        return {
            "tool": "governance",
            "status": "error",
            "message": str(e)
        }



@mcp.tool()
def operational_action(details: str):
    """
    Operational tool (DB + structured email)
    """

    import sqlite3
    import datetime
    import smtplib
    from email.mime.text import MIMEText

    try:
        print("\n⚙️ Operational tool triggered")
        print("Proposal:", details)

        category = "operational"
        action_type = "EXECUTE_UPDATE"
        priority = "medium"

        # =========================
        # 🗄️ STORE IN DB
        # =========================
        conn = sqlite3.connect("dao.db")
        cursor = conn.cursor()

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS operational_changes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            proposal TEXT,
            category TEXT,
            action_type TEXT,
            priority TEXT,
            created_at TEXT
        )
        """)

        cursor.execute("""
        INSERT INTO operational_changes
        (proposal, category, action_type, priority, created_at)
        VALUES (?, ?, ?, ?, ?)
        """, (
            details,
            category,
            action_type,
            priority,
            datetime.datetime.now().isoformat()
        ))

        conn.commit()
        conn.close()

        print("🗄️ Operational change stored")

        # =========================
        # 📧 EMAIL
        # =========================
        email_text = f"""
📢 DAO Operational Update

Proposal:
{details}

Category:
Operational

Action Type:
Immediate Backend/System Update

Details:
This proposal affects internal workflows or system operations.
It can be implemented without smart contract changes.

Next Steps:
- Review system impact
- Apply backend/config updates
- Monitor system behavior

Priority:
Medium
"""

        msg = MIMEText(email_text)

        msg["Subject"] = "DAO Operational Action Required"
        msg["From"] = "vijayanthvenkat96@gmail.com"
        msg["To"] = "blockchain42project@gmail.com"

        try:
            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
                server.login("vijayanthvenkat96@gmail.com", "plsntsthiiddgxik")
                server.send_message(msg)

            print("📧 Operational email sent")

        except Exception as e:
            print("⚠️ Email failed:", e)

        return {
            "tool": "operational",
            "status": "processed",
            "stored": True,
            "email_sent": True
        }

    except Exception as e:
        return {
            "tool": "operational",
            "status": "error",
            "message": str(e)
        }


@mcp.tool()
def security_action(details: str):
    """
    Security tool (DB + structured email)
    """

    import sqlite3
    import datetime
    import smtplib
    from email.mime.text import MIMEText

    try:
        print("\n🔐 Security tool triggered")
        print("Proposal:", details)

        category = "security"
        action_type = "SECURITY_ALERT"
        priority = "high"

        # =========================
        # 🗄️ STORE IN DB
        # =========================
        conn = sqlite3.connect("dao.db")
        cursor = conn.cursor()

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS security_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            proposal TEXT,
            category TEXT,
            action_type TEXT,
            priority TEXT,
            created_at TEXT
        )
        """)

        cursor.execute("""
        INSERT INTO security_alerts
        (proposal, category, action_type, priority, created_at)
        VALUES (?, ?, ?, ?, ?)
        """, (
            details,
            category,
            action_type,
            priority,
            datetime.datetime.now().isoformat()
        ))

        conn.commit()
        conn.close()

        print("🗄️ Security alert stored")

        # =========================
        # 📧 EMAIL
        # =========================
        email_text = f"""
🚨 DAO SECURITY ALERT

Proposal:
{details}

Category:
Security

Action Type:
Immediate Attention Required

Details:
This proposal indicates a potential security concern.
Immediate review and action is required.

Next Steps:
- Investigate the issue
- Check affected systems/users
- Apply necessary restrictions or fixes

Priority:
HIGH 🚨
"""

        msg = MIMEText(email_text)

        msg["Subject"] = "🚨 DAO Security Alert"
        msg["From"] = "vijayanthvenkat96@gmail.com"
        msg["To"] = "blockchain42project@gmail.com"

        try:
            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
                server.login("vijayanthvenkat96@gmail.com", "plsntsthiiddgxik")
                server.send_message(msg)

            print("📧 Security email sent")

        except Exception as e:
            print("⚠️ Email failed:", e)

        return {
            "tool": "security",
            "status": "processed",
            "stored": True,
            "email_sent": True
        }

    except Exception as e:
        return {
            "tool": "security",
            "status": "error",
            "message": str(e)
        }

# =========================
# 🚀 DAO ROUTER (FINAL)
# =========================

@mcp.tool()
def dao_router(description: str, analysis: dict):
    """
    Routes proposal based on AI advisor output
    """
    return route_proposal(description, analysis)


def route_proposal(description: str, analysis: dict):

    try:
        # =========================
        # 🧠 GET CATEGORY FROM ADVISOR
        # =========================
        category = analysis.get("category", "unknown")

        if category:
            category = category.lower().strip()

        print("\n🧭 Routing based on category:", category)

    except Exception as e:
        print("⚠️ Routing error:", e)
        category = "unknown"

    # =========================
    # 🔁 FALLBACK (VERY IMPORTANT)
    # =========================
    if category == "unknown":
        category = fallback_category(description)
        print("⚠️ Using fallback category:", category)

    # =========================
    # 🚀 ROUTING LOGIC
    # =========================
    if category == "financial":
        result = financial_action(description)

    elif category == "hiring":
        result = hiring_action(description)

    elif category == "governance":
        # result = governance_action(description)
        result = governance_action(description)

    elif category == "operational":
        result = operational_action(description)

    elif category == "security":
        result = security_action(description)

    else:
        result = {"tool": "none", "message": "Unknown category"}

    return {
        "category": category,
        "tool_result": result
    }


# =========================
# 🔥 FALLBACK CATEGORY
# =========================
def fallback_category(description: str):

    desc = description.lower()

    if "quorum" in desc or "vote" in desc or "governance" in desc:
        return "governance"
    elif "hire" in desc or "recruit" in desc:
        return "hiring"
    elif "budget" in desc or "fund" in desc or "money" in desc:
        return "financial"
    elif "access" in desc or "security" in desc:
        return "security"
    else:
        return "operational"


# =========================
# INIT ALWAYS (IMPORTANT)
# =========================


reset_aux_db()
init_db()
seed_data()


# =========================
# RUN
# =========================

if __name__ == "__main__":
    print("🚀 DAO AI MCP Server running...")
    mcp.run(transport="stdio")