"""Generates the Level 0 DFD (Figure 3) as SVG. Run: python3 diagrams/render_level0_dfd.py"""
from pathlib import Path
from xml.sax.saxutils import escape

OUT = Path(__file__).with_name("level0_dfd_system_modules.svg")

# External entities (left side, each with its own vertical line and color)
ENT = {
    "A": ("Administrator\n(Web Portal)", "#1f5fa8"),
    "W": ("Farm Worker /\nMaintenance\n(Mobile App)", "#2e7d32"),
    "O": ("Farm Owner\n(Web, read-only)", "#7b3fa0"),
    "B": ("Buyer\n(Web / Mobile)", "#c25400"),
}
ENT_ORDER = ["A", "W", "O", "B"]

# Each process: (id, name, left flows [(entity, direction, label)], right side objects)
# direction ">" = entity to process, "<" = process to entity
# right side: (kind, code, name, in_label, out_label); kind "store" or "entity"
P = [
    ("1.0", "Registration and\nAccount Management", [
        ("A", ">", "Worker accounts, roles, reset approvals"),
        ("A", "<", "User list, attendance, leave & reset requests"),
        ("W", ">", "Login credentials, clock in/out, leave"),
        ("W", "<", "Account access, attendance records"),
        ("O", ">", "Login credentials"),
        ("O", "<", "Account access"),
        ("B", ">", "Registration details, location, login"),
        ("B", "<", "Email verification, account status"),
    ], [("store", "D1", "Users", "User profile, role, attendance", "Account status, profile data")]),
    ("2.0", "Image Classification\n(Ripeness and Bean)", [
        ("W", ">", "Cherry images, tree / section"),
        ("W", "<", "Ripeness & bean classification result"),
        ("A", ">", "Batch details"),
        ("A", "<", "Scan history, batch & grade summaries"),
    ], [("store", "D2", "Classification\nRecords", "Scan & grade results", "Classification history"),
        ("entity", "", "Roboflow\nDetection API", "Cherry image", "Ripeness detections")]),
    ("3.0", "Farm Management", [
        ("A", ">", "Sections, trees, harvest schedules, tasks"),
        ("A", "<", "Farm records, field reports"),
        ("W", ">", "Harvest readiness, pest/disease, irrigation reports"),
        ("W", "<", "Farm sections, schedules, report status"),
    ], [("store", "D3", "Farm Records", "Farm management data", "Farm details")]),
    ("4.0", "Inventory and\nEquipment Management", [
        ("A", ">", "Equipment, supplies, repair job assignment"),
        ("A", "<", "Inventory status, condition & damage reports"),
        ("W", ">", "Borrow/return, supply use, condition, repair progress"),
        ("W", "<", "Equipment & supply status, assigned repair jobs"),
    ], [("store", "D4", "Inventory &\nEquipment", "Inventory & repair data", "Equipment status")]),
    ("5.0", "Buyers' Map", [
        ("B", ">", "Buyer location, address"),
        ("A", "<", "Nearby buyers map, distance, purchase totals"),
    ], [("store", "D5", "Buyers", "Buyer location data", "Buyer details")]),
    ("6.0", "Profit and Sales\nManagement", [
        ("A", ">", "Sales, expenses, payroll"),
        ("A", "<", "Profit reports, financial dashboard"),
        ("O", "<", "Profit & revenue reports (read-only)"),
    ], [("store", "D6", "Profit Data", "Transaction data", "Sales and profit summary")]),
    ("7.0", "Maintenance\n(Buyer Records & Orders)", [
        ("B", ">", "Product orders (cart, checkout)"),
        ("B", "<", "Product listings, order status, pickup"),
        ("A", ">", "Buyer records, order status updates"),
        ("A", "<", "Buyer records, purchase history, orders"),
    ], [("store", "D7", "Buyer Orders", "Order & stock-hold data", "Updated records")]),
    ("8.0", "Communication\n(SMS and Messages)", [
        ("A", ">", "SMS broadcasts, message to owner"),
        ("A", "<", "Worker replies, owner messages"),
        ("W", ">", "SMS messages"),
        ("W", "<", "Admin broadcasts"),
        ("O", ">", "Message to admin"),
        ("O", "<", "Admin messages"),
    ], [("store", "D8", "Messages", "Message data", "Message history")]),
    ("9.0", "Data and Sync", [
        ("W", ">", "Offline records (queued)"),
        ("W", "<", "Sync status"),
        ("A", "<", "Database & sync health"),
    ], [("store", "D9", "Local Data", "Offline data", "Synced data")]),
]

# ---- geometry ----
FONT = "Arial, Helvetica, sans-serif"
BUS_X = {"A": 75, "W": 195, "O": 315, "B": 435}
ENT_W, ENT_H, ENT_TOP = 116, 64, 20
LABEL_X = 470
PX, PW = 820, 250            # process box
SX = 1380                    # store / right entity box x
SW = 250
ROW_GAP = 34
FLOW_DY = 24
width = SX + SW + 30

svg = []
def text(x, y, s, size=13, anchor="start", weight="normal", fill="#111", style=""):
    lines = s.split("\n")
    for i, ln in enumerate(lines):
        dy = (i - (len(lines) - 1) / 2) * (size * 1.2)
        svg.append(f'<text x="{x}" y="{y + dy + size * 0.35:.1f}" font-family="{FONT}" font-size="{size}" '
                   f'text-anchor="{anchor}" font-weight="{weight}" fill="{fill}" {style}>{escape(ln)}</text>')

def arrow(x1, y1, x2, y2, color="#111"):
    svg.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="1.6" '
               f'marker-end="url(#ah-{color[1:]})"/>')

colors = {c for _, c in ENT.values()} | {"#111111"}
defs = "".join(
    f'<marker id="ah-{c[1:]}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" '
    f'orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{c}"/></marker>' for c in colors)

y = ENT_TOP + ENT_H + 50
bus_end = {}
for pid, name, flows, right in P:
    n_left = len(flows)
    n_right = sum(2 for _ in right)
    h = max(n_left * FLOW_DY + 40, len(right) * 110 - 20, 110)
    top = y
    # process box (rounded, with id header like Gane-Sarson)
    svg.append(f'<rect x="{PX}" y="{top}" width="{PW}" height="{h}" rx="14" fill="#fff" stroke="#111" stroke-width="2"/>')
    svg.append(f'<line x1="{PX}" y1="{top + 30}" x2="{PX + PW}" y2="{top + 30}" stroke="#111" stroke-width="2"/>')
    text(PX + PW / 2, top + 15, pid, 15, "middle", "bold")
    text(PX + PW / 2, top + 30 + (h - 30) / 2, name, 16, "middle")
    # left flows
    fy0 = top + 30 + (h - 30 - (n_left - 1) * FLOW_DY) / 2
    for i, (e, d, lbl) in enumerate(flows):
        fy = fy0 + i * FLOW_DY
        c = ENT[e][1]
        bx = BUS_X[e]
        if d == ">":
            arrow(bx, fy, PX, fy, c)
        else:
            arrow(PX, fy, bx + 1, fy, c)
        svg.append(f'<circle cx="{bx}" cy="{fy}" r="3" fill="{c}"/>')
        text(LABEL_X, fy - 8, lbl, 12, fill=c)
        bus_end[e] = max(bus_end.get(e, 0), fy)
    # right side objects
    slot = h / len(right)
    for j, (kind, code, sname, lin, lout) in enumerate(right):
        cy = top + slot * j + slot / 2
        bh = 64
        by = cy - bh / 2
        if kind == "store":
            svg.append(f'<path d="M{SX + SW},{by} H{SX} V{by + bh} H{SX + SW}" fill="#fff" stroke="#111" stroke-width="2"/>')
            svg.append(f'<rect x="{SX}" y="{by}" width="{SW}" height="{bh}" fill="#fff" stroke="none"/>')
            svg.append(f'<path d="M{SX + SW},{by} H{SX} V{by + bh} H{SX + SW}" fill="none" stroke="#111" stroke-width="2"/>')
            svg.append(f'<line x1="{SX + 60}" y1="{by}" x2="{SX + 60}" y2="{by + bh}" stroke="#111" stroke-width="2"/>')
            text(SX + 30, cy, code, 15, "middle", "bold")
            text(SX + 72, cy, sname, 15)
        else:
            svg.append(f'<rect x="{SX}" y="{by}" width="{SW}" height="{bh}" fill="#fff" stroke="#111" stroke-width="2"/>')
            text(SX + SW / 2, cy, sname + "\n(external)", 14, "middle", "bold")
        arrow(PX + PW, cy - 12, SX, cy - 12, "#111111")
        arrow(SX, cy + 14, PX + PW, cy + 14, "#111111")
        text((PX + PW + SX) / 2, cy - 20, lin, 12, "middle")
        text((PX + PW + SX) / 2, cy + 6, lout, 12, "middle")
    y = top + h + ROW_GAP

height = y + 70
# entity boxes and their vertical lines (drawn first so boxes sit on top)
head = []
for e in ENT_ORDER:
    name, c = ENT[e]
    bx = BUS_X[e]
    head.append(f'<line x1="{bx}" y1="{ENT_TOP + ENT_H}" x2="{bx}" y2="{bus_end[e]}" stroke="{c}" stroke-width="1.8"/>')
    head.append(f'<rect x="{bx - ENT_W / 2}" y="{ENT_TOP}" width="{ENT_W}" height="{ENT_H}" fill="#fff" stroke="{c}" stroke-width="2.2"/>')
body = svg
svg = []
for e in ENT_ORDER:
    text(BUS_X[e], ENT_TOP + ENT_H / 2, ENT[e][0], 12, "middle", "bold", ENT[e][1])
labels = svg
svg = []
text(width / 2, height - 30, "Figure 3. Level 0 Diagram", 22, "middle", "bold", style='font-style="italic"')
footer = svg

out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
       f'<defs>{defs}</defs>', f'<rect width="100%" height="100%" fill="#fff"/>',
       *head, *body, *labels, *footer, '</svg>']
OUT.write_text("\n".join(out))
print(OUT, width, height)
