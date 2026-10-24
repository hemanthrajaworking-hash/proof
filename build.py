import os,shutil,html
P='/workspace/empire/portfolio'
CSS="""body{font:16px/1.6 system-ui,sans-serif;margin:0;color:#1d2433;background:#fafbfc}
main{max-width:820px;margin:auto;padding:24px}header{background:#14324f;color:#fff;padding:28px 24px}
header div{max-width:820px;margin:auto}header a{color:#bfe0ff}h1{margin:0 0 6px;font-size:28px}
.card{background:#fff;border:1px solid #e3e7ee;border-radius:10px;padding:18px;margin:14px 0}
a{color:#0b5cad}img{max-width:100%;border:1px solid #ddd;border-radius:6px}
.tag{display:inline-block;background:#e8f1fb;color:#14324f;border-radius:20px;padding:2px 10px;font-size:13px;margin-right:6px}
.cta{background:#0b5cad;color:#fff!important;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block}
footer{color:#667;font-size:14px;text-align:center;padding:24px}"""
MAIL='hemanthrajaworking@gmail.com'
def page(path,title,sub,body,depth):
    up='../'*depth
    os.makedirs(os.path.dirname(path) or '.',exist_ok=True)
    open(path,'w').write(f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} | Hemanth Raja</title><meta name="description" content="{html.escape(sub)}"><link rel="stylesheet" href="{up}style.css"></head><body>
<header><div><a href="{up}index.html">Hemanth Raja · Finance automation &amp; AI workflows</a><h1>{title}</h1><p>{sub}</p></div></header>
<main>{body}<div class="card"><b>Price:</b> a fixed price, quoted after a free sample.<br><br><a class="cta" href="mailto:{MAIL}?subject={title.replace(' ','%20')}">Email me for a free sample</a> &nbsp; {MAIL}</div></main>
<footer>All examples use demo or synthetic data. No client data is shown. · Hyderabad, India · <a href="mailto:{MAIL}">{MAIL}</a></footer></body></html>""")
open('style.css','w').write(CSS)
# proof pages: key -> (title, sub, what, tests, shots)
W={
'finops-agent':('Month-end close pipeline (8 steps, human approval)','A multi-step finance workflow: invoice intake, 3-way match, bank match, tax credit match, variance report, report checker and an approval gate.',
 ['A planner runs 8 steps in the right order from their inputs and outputs.','A checker scores the written report and blocks over-claims such as "no exceptions". The report must score at least 0.80 to pass.','Nothing is paid or claimed until a named person approves.','Every step is written to a tamper-evident (hash-chained) audit log, with a web dashboard per run.','Works with a free local model, and falls back to a fixed-template report if the model is slow.'],'10 automated tests pass, plus a full demo run and audit check.'),
'eval-lab':('AI answer testing &amp; safety checks','An offline lab that checks whether a chatbot or AI answer is correct, grounded in the documents, and safe.',
 ['Scores answers with weighted rubrics and an optional local AI judge.','Flags made-up numbers and forbidden claims.','Measures document search quality (recall@k, MRR, nDCG).','Red-team tests: prompt injection, invoice fraud, privacy, false premise, impersonation. An item passes only if the bot refuses and leaks nothing.','A release gate fails automatically when quality drops. In the demo it caught recall falling from 1.0 to 0.875 when search depth was cut.'],'8 automated tests pass, plus a demo that runs the gate.'),
'voice-rag-agent':('Voice + document Q&amp;A agent (English, Hindi, Telugu)','A support agent that answers only from company documents, cites its source, and hands off to a person when unsure.',
 ['Understands English, Hindi, Telugu and mixed language (Hinglish, Tenglish).','Every answer shows which document it came from.','Hands off on low confidence, complaints, or sensitive data like card numbers or OTPs.','Logs each chat as a ticket and drafts follow-up emails for human approval only. It has no send code.','Local speech-to-text and text-to-speech. Runs offline on a normal CPU. Demo company is fictional.'],'15 automated tests pass. Routing: 12 of 12 tuning questions and 7 of 8 held-out questions correct.'),
'ap-automation':('Invoice vs PO vs receipt matching (3-way match)','Checks each supplier invoice against its purchase order and goods receipt before payment.',
 ['Holds an invoice when the price is outside tolerance (2%, adjustable), more units are billed than received, there is no PO, or it is a duplicate.','Writes a PAY / HOLD list with a reason on every line.','A person approves. The tool never pays anything.'],'13 automated tests pass, plus a demo run with one planted case per rule.'),
'invoice-extractor':('Invoice data extraction (OCR to Excel)','Reads invoice images and turns them into a checked spreadsheet and journal, with doubtful ones sent for review.',
 ['Free local OCR (Tesseract). Pulls invoice number, date, tax ID, amounts and total.','Checks the tax ID checksum and that the tax adds up to the total.','Anything below 0.85 confidence goes to a review queue, so a person checks only the flagged ones.','Clean invoices become a balanced purchase journal and an Excel register.','Limit: tuned to labelled layouts today; free-form layouts need an extra AI step.'],'13 automated tests pass, plus a demo on 4 sample invoices.'),
'fpa-variance-forecast':('Month-end budget vs actual pack','Budget vs actual by line, with only the variances that matter flagged and explained.',
 ['Knows that under-spending on a cost line is good news, not bad.','Flags a variance only when both the % and the amount are big enough (both adjustable).','Writes a one-line comment for each material variance.','Adds a simple 3-month trend forecast per line.','Output: a 4-sheet Excel pack and an HTML dashboard.'],'13 automated tests pass, plus a demo run.'),
'gst-itc-recon':('Ledger vs statement matching (exceptions only)','Matches your books line by line against an outside statement and lists every line that does not match, with a reason. Built first for Indian GST purchase records; the same matching method fits marketplace payout vs order checks.',
 ['Matches in passes: exact, then cleaned-up invoice numbers, then the same invoice under a different ID.','Small rounding tolerance (adjustable).','Gives every line a status (for example value mismatch, missing in statement, missing in books) and a plain-English next step.','Exports an Excel workbook and an HTML exceptions report.'],'12 automated tests pass, plus a demo run.'),
}
SHOT={'finops-agent':['dashboard.png'],'eval-lab':['dashboard.png'],'voice-rag-agent':['web_demo.png'],'invoice-extractor':['inv3.png'],'fpa-variance-forecast':['dashboard.png'],'gst-itc-recon':['exceptions_report.png']}
for k,(t,s,pts,tests) in W.items():
    d=f'work/{k}'; os.makedirs(d,exist_ok=True); imgs=''
    for f in SHOT.get(k,[]):
        src=f'{P}/{k}/screenshots/{f}'
        if os.path.exists(src): shutil.copy(src,f'{d}/{f}'); imgs+=f'<p><img src="{f}" alt="Screenshot of {t} on demo data" loading="lazy"></p>'
    li=''.join(f'<li>{x}</li>' for x in pts)
    page(f'{d}/index.html',t,s,f'<div class="card"><h2>What it does</h2><ul>{li}</ul></div><div class="card"><h2>Checked</h2><p>{tests} Tests last run 23 Oct 2026 on demo data.</p></div>{imgs}',2)
O=[('agencies','For AI &amp; automation agencies (white-label)','Extra build capacity you can sell under your own name.',
  [('White-label automation build','finops-agent','One workflow built with tests and a handover note. No long contract.'),('AI answer testing for your client\'s bot','eval-lab','Check a bot for wrong answers, made-up numbers and unsafe replies before it goes live.'),('Voice / document Q&amp;A agent prototype','voice-rag-agent','A working prototype that answers from documents and hands off to a person.')]),
 ('bookkeepers','For bookkeepers &amp; small accounting firms (US, UK, AU)','Tools that do the matching and leave only the exceptions for your team.',
  [('Bank + invoice reconciliation setup','ap-automation','Free sample: 20 invoices or one month of one bank account (anonymised is fine).'),('Invoice data extraction','invoice-extractor','Invoice images into a checked spreadsheet, with doubtful ones flagged.'),('Month-end close pack','fpa-variance-forecast','Budget vs actual with material variances explained.')]),
 ('sellers','For Shopify, Amazon &amp; Flipkart sellers','Payout (settlement) vs order checks, so short payments are not missed.',
  [('Payout / settlement reconciliation check','gst-itc-recon','Free check of one month of one channel. You see every line that does not match.'),('Monthly reconciliation run','finops-agent','The same check every month, with a person approving the result.')])]
for slug,t,s,items in O:
    b=''.join(f'<div class="card"><h2>{n}</h2><p>{x}</p><p><a href="../work/{k}/">See a working example (demo data) →</a></p></div>' for n,k,x in items)
    page(f'offers/{slug}.html',t,s,b+'<div class="card"><h2>How it works</h2><ol><li>You send a small sample (anonymised is fine).</li><li>I run it free and show you the result.</li><li>If it helps, I quote a fixed price.</li></ol></div>',1)
cards=''.join(f'<div class="card"><h2><a href="offers/{slug}.html">{t}</a></h2><p>{s}</p></div>' for slug,t,s,_ in O)
# Hand-written pages under work/. Keep them off W so page() does not overwrite their HTML.
EXTRA=[('seller-payout-demo','Demo: payout matching on sample records'),('seller-payout-case-study','Case study (sample): payout cleanup for an online seller')]
work=''.join(f'<li><a href="work/{k}/">{v[0]}</a></li>' for k,v in W.items())+''.join(f'<li><a href="work/{k}/">{t}</a></li>' for k,t in EXTRA)
page('index.html','Finance automation &amp; AI workflows, with a human in control','I am Hemanth Raja: MBA in Finance, about five years of tax, GST and bookkeeping practice, and I build tested automation tools.',
 cards+f'<div class="card"><h2>Working examples</h2><ul>{work}</ul><p>Every example runs on demo data and has automated tests.</p></div>',0)
open('.nojekyll','w').write('')
