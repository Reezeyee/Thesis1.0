"""Generates the Level 0 DFD (Figure 3) as SVG, styled like the thesis draft figure.
Run: python3 diagrams/render_level0_dfd.py"""
from pathlib import Path
from xml.sax.saxutils import escape

OUT = Path(__file__).with_name("level0_dfd_system_modules.svg")
FONT = "Inter, Arial, Helvetica, sans-serif"

# Vertical line (bus) x-position of each external entity
BUS = {"A": 55, "O": 95, "W": 150, "B": 215}

# (id, name, left flows [(entity, ">" into process | "<" out of process, label)], right objects)
# right object: (kind, code, name, label to object, label back to process)
P = [
    ("1.0", "Registration\nand Account\nManagement", [
        ("A", ">", "User accounts, roles"),
        ("A", "<", "User list, reset requests"),
        ("W", ">", "Login credentials, attendance"),
        ("W", "<", "Account access"),
        ("O", ">", "Login credentials"),
        ("O", "<", "Account access"),
        ("B", ">", "Registration, login details"),
        ("B", "<", "Account status"),
    ], [("store", "D1", "Users", "User information", "Account status, profile data")]),
    ("2.0", "Image Classification\n(Ripeness and Bean)", [
        ("W", ">", "Cherry images"),
        ("W", "<", "Classification result"),
        ("A", ">", "Batch details"),
        ("A", "<", "Scan and grade summaries"),
    ], [("store", "D2", "Classification\nDataset", "Image data", "Classification result"),
        ("entity", "", "Roboflow API", "Cherry image", "Ripeness detections")]),
    ("3.0", "Farm Management", [
        ("A", ">", "Farm layout, trees, schedules, tasks"),
        ("A", "<", "Farm records"),
        ("W", ">", "Harvest, pest, disease, irrigation reports"),
        ("W", "<", "Farm schedules, report status"),
    ], [("store", "D3", "Farm Records", "Farm management data", "Farm details")]),
    ("4.0", "Inventory and\nEquipment Management", [
        ("A", ">", "Equipment, supplies, repair assignment"),
        ("A", "<", "Inventory status, damage reports"),
        ("W", ">", "Equipment usage, repair progress"),
        ("W", "<", "Equipment status, repair jobs"),
    ], [("store", "D4", "Inventory &\nEquipment", "Inventory data", "Equipment status")]),
    ("5.0", "Buyers' Map", [
        ("B", ">", "Buyer information, location"),
        ("A", "<", "Nearby buyers list"),
    ], [("store", "D5", "Buyers", "Buyer data", "Buyer details")]),
    ("6.0", "Profit and Sales\nManagement", [
        ("A", ">", "Sales data, expenses, payroll"),
        ("A", "<", "Profit reports"),
        ("O", "<", "Profit and revenue reports"),
    ], [("store", "D6", "Profit Data", "Transaction data", "Sales and profit summary")]),
    ("7.0", "Maintenance", [
        ("B", ">", "Product orders"),
        ("B", "<", "Order status, pickup details"),
        ("A", ">", "Buyer records, order updates"),
        ("A", "<", "Buyer records, purchase history"),
    ], [("store", "D7", "Maintenance", "Maintenance data", "Updated records")]),
    ("8.0", "Communication", [
        ("A", ">", "SMS broadcasts, messages"),
        ("A", "<", "Worker and owner messages"),
        ("W", ">", "SMS messages"),
        ("W", "<", "Admin broadcasts"),
        ("O", ">", "Message to admin"),
        ("O", "<", "Admin messages"),
    ], [("store", "D8", "Messages", "Message data", "Message history")]),
    ("9.0", "Data and Sync", [
        ("W", ">", "Sync request, offline data"),
        ("W", "<", "Sync status"),
        ("A", "<", "Database and sync status"),
    ], [("store", "D9", "Local Data", "Offline data", "Synced data")]),
]

LBL_L, PX, PW = 235, 560, 230      # label zone start, process box x / width
SX, SW = 1010, 240                 # right column (stores / external entity)
FLOW_DY, ROW_GAP, TOP = 28, 36, 150
W_BOX = (102, 198)                 # worker box x-range (bus at 150)

svg = []
def text(x, y, s, size=15, anchor="middle", weight="normal", italic=False):
    lines = s.split("\n")
    st = ' font-style="italic"' if italic else ""
    for i, ln in enumerate(lines):
        dy = (i - (len(lines) - 1) / 2) * size * 1.2
        svg.append(f'<text x="{x:.1f}" y="{y + dy + size * 0.35:.1f}" font-family="{FONT}" font-size="{size}" '
                   f'text-anchor="{anchor}" font-weight="{weight}"{st}>{escape(ln)}</text>')

def line(x1, y1, x2, y2, arrow=False):
    m = ' marker-end="url(#ah)"' if arrow else ""
    svg.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="#111" stroke-width="1.8"{m}/>')

def box(x, y, w, h, rx=0, sw=2.2):
    svg.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="#fff" stroke="#111" stroke-width="{sw}"/>')

y = TOP
span = {}                            # entity -> [min y, max y] of its flows
rows = []
for pid, name, flows, right in P:
    h = max(len(flows) * FLOW_DY + 44, len(right) * 100, 118)
    rows.append((pid, name, flows, right, y, h))
    y += h + ROW_GAP
height = y + 170

# Worker box sits beside process 2.0, like the draft figure
r2_top, r2_h = rows[1][4], rows[1][5]
w_box_y = r2_top - 5

# flows: collect y positions first so buses can be drawn underneath
flow_ys = []
for pid, name, flows, right, top, h in rows:
    y0 = top + 34 + (h - 34 - (len(flows) - 1) * FLOW_DY) / 2
    for i, (e, d, lbl) in enumerate(flows):
        fy = y0 + i * FLOW_DY
        if pid == "2.0":  # worker flows leave the worker box; admin flows pass below it
            fy = [top + 22, top + 50, top + 120, top + 148][i]
        flow_ys.append((e, d, lbl, fy))
        lo, hi = span.get(e, (fy, fy))
        span[e] = (min(lo, fy), max(hi, fy))

A_BOX = (20, 30, 230, 70)                         # Administrator box, top-left
BOT_Y = height - 150                              # Farm Owner / Buyer boxes, bottom-left
O_BOX = (31, BOT_Y, 128, 66)
B_BOX = (160, BOT_Y, 110, 66)
# buses
line(BUS["A"], A_BOX[1] + A_BOX[3], BUS["A"], span["A"][1])
line(BUS["O"], span["O"][0], BUS["O"], BOT_Y)
line(BUS["B"], span["B"][0], BUS["B"], BOT_Y)
line(BUS["W"], span["W"][0], BUS["W"], span["W"][1])

for e, d, lbl, fy in flow_ys:
    bx = BUS[e]
    if e == "W" and w_box_y <= fy <= w_box_y + 70:
        bx = W_BOX[1]
    if d == ">":
        line(bx, fy, PX, fy, True)
    else:
        line(PX, fy, bx, fy, True)
    text((LBL_L + PX) / 2, fy - 10, lbl, 13.5)

# entity boxes
box(*A_BOX); text(A_BOX[0] + A_BOX[2] / 2, A_BOX[1] + A_BOX[3] / 2, "Administrator", 18)
box(W_BOX[0], w_box_y, W_BOX[1] - W_BOX[0], 70); text(sum(W_BOX) / 2, w_box_y + 35, "Farm Worker\n(Mobile App)", 14.5)
box(*O_BOX); text(O_BOX[0] + O_BOX[2] / 2, BOT_Y + 33, "Farm Owner", 18)
box(*B_BOX); text(B_BOX[0] + B_BOX[2] / 2, BOT_Y + 33, "Buyer", 18)

# processes and right-hand objects
for pid, name, flows, right, top, h in rows:
    box(PX, top, PW, h, rx=16)
    line(PX, top + 34, PX + PW, top + 34)
    text(PX + PW / 2, top + 17, pid, 18)
    text(PX + PW / 2, top + 34 + (h - 34) / 2, name, 17)
    slot = h / len(right)
    for j, (kind, code, sname, lin, lout) in enumerate(right):
        cy = top + slot * j + slot / 2
        box(SX, cy - 26, SW, 52, sw=1.8)
        if kind == "store":
            line(SX + 60, cy - 26, SX + 60, cy + 26)
            text(SX + 30, cy, code, 16, weight="bold")
            text(SX + 76, cy, sname, 16, anchor="start")
        else:
            text(SX + SW / 2, cy, sname, 17)
        line(PX + PW, cy - 12, SX, cy - 12, True)
        line(SX, cy + 14, PX + PW, cy + 14, True)
        mid = (PX + PW + SX) / 2
        text(mid, cy - 22, lin, 13.5)
        text(mid, cy + (4 if "\n" not in lout else -4), lout, 13.5)

width = SX + SW + 25
svg.append(f'<text x="{width / 2:.1f}" y="{height - 30}" font-family="{FONT}" font-size="26" text-anchor="middle">'
           '<tspan font-weight="bold" font-style="italic">Figure 3.</tspan>'
           '<tspan font-style="italic"> Level 0</tspan><tspan> Diagram</tspan></text>')

out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
       '<defs><marker id="ah" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto">'
       '<path d="M0,0 L10,5 L0,10 z" fill="#111"/></marker></defs>',
       '<rect width="100%" height="100%" fill="#fbfbfb"/>', *svg, '</svg>']
OUT.write_text("\n".join(out))
print(OUT, width, height)
