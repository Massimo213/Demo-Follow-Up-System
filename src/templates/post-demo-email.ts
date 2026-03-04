/**
 * Post-Demo Email Templates
 * 4-touch kill-or-close sequence.
 * Every message re-anchors to their numbers. Binary: implement or close file.
 */

import type { Prospect, ProspectMessageType } from '@/types/prospect';
import { calculateROI, formatCurrency } from '@/lib/roi-calculator';

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function wrapHtml(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px; }
    .cta { display: inline-block; background: #0066ff; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; font-size: 15px; }
    .cta:hover { background: #0052cc; }
    .muted { color: #666; font-size: 14px; }
    .numbers-box { background: #f8f9fa; border-left: 4px solid #0066ff; padding: 16px 20px; margin: 20px 0; border-radius: 0 6px 6px 0; }
    .numbers-box strong { color: #0066ff; }
    .gap-box { background: #fff3f3; border-left: 4px solid #e53e3e; padding: 16px 20px; margin: 20px 0; border-radius: 0 6px 6px 0; }
    .gap-box strong { color: #e53e3e; }
    .result-box { background: #f0fff4; border-left: 4px solid #38a169; padding: 16px 20px; margin: 20px 0; border-radius: 0 6px 6px 0; }
    .result-box strong { color: #38a169; }
    ul.recap { margin: 12px 0; padding-left: 20px; }
    ul.recap li { margin: 6px 0; }
    h3 { font-size: 16px; margin: 24px 0 12px; color: #1a1a1a; }
    hr.sep { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
  </style>
</head>
<body>
${content}
</body>
</html>`;
}

function firstName(prospect: Prospect): string {
  return prospect.name.split(' ')[0];
}

export class PostDemoEmailTemplates {
  static getTemplate(
    messageType: ProspectMessageType,
    prospect: Prospect
  ): EmailTemplate | null {
    const templates: Partial<Record<ProspectMessageType, () => EmailTemplate>> = {
      PD_RECAP_ROI: () => this.recapGo(prospect),
      PD_STAKEHOLDER_BRIEF: () => this.internalPolitics(prospect),
      PD_DIRECT_ASK: () => this.directAsk(prospect),
      PD_CLOSING_FILE: () => this.closingFile(prospect),
    };

    const templateFn = templates[messageType];
    return templateFn ? templateFn() : null;
  }

  /**
   * Touch 1 (T+30min): Full recap — numbers, Elystra Delta, what it changes, how we wire it, guarantee, binary next step
   */
  static recapGo(prospect: Prospect): EmailTemplate {
    const name = firstName(prospect);
    const X = prospect.proposals_per_month;
    const Y = prospect.avg_deal_size;
    const Z = prospect.close_rate;
    const D = prospect.time_to_cash_days;
    const dealsClosed = (X * Z) / 100;
    const dealsDying = X * (1 - Z / 100);
    const oneDealValue = Y;
    const twoDealsValue = 2 * Y;
    const annualOneDeal = 12 * Y;
    const annualTwoDeals = 24 * Y;
    const netOneDeal = Math.max(0, Y - 1500);
    const netTwoDeals = Math.max(0, 2 * Y - 1500);

    const html = `
<p>Hey ${name},</p>

<p>Quick recap from today in hard numbers:</p>
<ul class="recap">
  <li>Proposals sent/month: ~${X}</li>
  <li>Avg deal size: ~${formatCurrency(Y)}</li>
  <li>Close rate after proposal: ~${Z}%</li>
  <li>Days from "yes" to cash in bank: ~${D}</li>
</ul>

<p>That means, right now you're:</p>
<ul class="recap">
  <li>Closing ≈ ${dealsClosed.toFixed(1)} deals/month</li>
  <li>Letting ≈ ${dealsDying.toFixed(0)} deals die after the proposal</li>
  <li>Waiting ${D} days to see money from deals you've already won</li>
</ul>

<p>Across agency pipelines that look like yours, a pessimistic Elystra Delta is:</p>
<ul class="recap">
  <li>+1–2 recovered deals/month from the same proposal volume</li>
  <li>10–15 days faster from "yes" → cash collected</li>
</ul>

<p>At your ACV (~${formatCurrency(Y)}):</p>
<ul class="recap">
  <li>+1 deal/month = +${formatCurrency(oneDealValue)}/month ≈ ${formatCurrency(annualOneDeal)}/year</li>
  <li>+2 deals/month = +${formatCurrency(twoDealsValue)}/month ≈ ${formatCurrency(annualTwoDeals)}/year</li>
</ul>

<p>Elystra is $1,500/month.</p>

<p>If Elystra only helps you claw back 1 extra serious deal/month, your net after paying us is roughly ${formatCurrency(netOneDeal)}.<br>
At 2 extra deals/month, you're closer to ${formatCurrency(netTwoDeals)} in net lift.</p>

<p>You're not buying software.<br>
You're deciding whether to keep burning those 1–2 deals every month, or not.</p>

<hr class="sep">

<h3>What Elystra actually changes</h3>

<p>You already saw the UI. Here's the impact in plain language:</p>

<p><strong>1. Proposal Clone + Engine</strong><br>
Same proposal structure you use today, rebuilt inside Elystra:</p>
<ul class="recap">
  <li>Your section titles and flow (e.g. "Strategy", "Investment", "Performance Dashboard")</li>
  <li>Your pricing logic (retainers, minimums, add-ons, terms)</li>
  <li>Zero admin work for the team, no ugly Canva / PowerPoint versioning</li>
  <li>Visually better than what most of your competitors send</li>
</ul>
<p>You keep your narrative and pricing logic. We remove grunt work and upgrade how you show up.</p>

<hr class="sep">

<p><strong>2. Sign → Pay in one rail</strong></p>
<p>Client signs and pays in the same motion.</p>
<p>You stop:</p>
<ul class="recap">
  <li>Waiting 20–30 days for "we'll get this to finance"</li>
  <li>Chasing invoices</li>
  <li>Letting closed-won sit as uncollected</li>
</ul>
<p>You become the agency that closes and collects cleanly, not the one that "follows up on invoices" for weeks.</p>

<p><strong>3. X-Ray on every deal</strong></p>
<p>You see exactly:</p>
<ul class="recap">
  <li>Who opened</li>
  <li>Which sections they read</li>
  <li>Where interest dies</li>
</ul>
<p>Follow-ups stop being "just checking in" and become surgical pushes at the choke-points. Pipeline reviews become data ("Section X kills deals") instead of stories.</p>

<p><strong>4. Behavior-based follow-ups</strong></p>
<p>Elystra triggers nudges when:</p>
<ul class="recap">
  <li>Pricing is viewed but the proposal isn't signed</li>
  <li>Signatures are done but payment is missing</li>
</ul>
<p>That's where the 1–2 extra closes per month quietly come from — the deals that used to die after "send the proposal over".</p>

<hr class="sep">

<h3>How we wire Elystra around how you sell</h3>

<p>If this matches reality on your side, next step is simple: we configure Elystra to mirror your rail.</p>

<p>Over 1–2 days we:</p>
<ul class="recap">
  <li><strong>Proposal structure</strong> – mirror your exact section titles, order, naming and flow, so clients still feel "this is our deck", just cleaner.</li>
  <li><strong>Pricing logic</strong> – encode your real economics: retainers, project fees, minimums, deposits, add-ons, term lengths. Reps stop rebuilding pricing in their heads.</li>
  <li><strong>Payment methods & rules</strong> – plug in how you actually collect: card / bank, upfront vs split payments, % retainers, when funds are due, what triggers invoicing.</li>
  <li><strong>Integrations</strong> – connect to your CRM / billing / project tools so deals, invoices and delivery don't get lost between systems. Sales, finance and delivery all see the same truth.</li>
  <li><strong>Email & follow-up tone</strong> (optional but lethal) – train reminders and nudges to sound like you: your phrasing, your directness, your warmth level. Same voice, just automated and behavior-driven.</li>
  <li><strong>User seats & permissions</strong> – map owners, AEs, CS, finance. Who can send, who approves, who sees money.</li>
</ul>
<p>$1,500/month includes 2 seats. Additional seats (AEs, CS) are $250/seat with role-based permissions.</p>

<p>In short: Elystra adapts to how you sell. Your team keeps running the same motion — the rail underneath just stops leaking.</p>

<hr class="sep">

<h3>Here's the deal:</h3>

<p>Run Elystra on your next 5–10 serious proposals for 30 days. If the deals you run through it don't close at a higher rate and don't pull cash in faster than your current setup, we refund the month. No forms, no negotiation, no conditions.</p>

<p>We either move your numbers, or you get your money back and we both walk.</p>

<hr class="sep">

<h3>Binary next step</h3>

<p>If you want to fix the rail:</p>
<p>Let us know your stand within the next 2 days. Then the next steps are:</p>
<ol>
  <li>Spin up your account,</li>
  <li>Mirror your proposal structure + pricing,</li>
  <li>Wire in payment + integrations,</li>
  <li>Run your first live deal through Elystra this week.</li>
</ol>

<p>If this isn't a priority, let us know and we close your file instead of dragging this out.</p>

<p>-- David, Elystra</p>`;

    const text = `Hey ${name},

Quick recap from today in hard numbers:
- Proposals sent/month: ~${X}
- Avg deal size: ~${formatCurrency(Y)}
- Close rate after proposal: ~${Z}%
- Days from "yes" to cash in bank: ~${D}

That means, right now you're:
- Closing ≈ ${dealsClosed.toFixed(1)} deals/month
- Letting ≈ ${dealsDying.toFixed(0)} deals die after the proposal
- Waiting ${D} days to see money from deals you've already won

Across agency pipelines that look like yours, a pessimistic Elystra Delta is:
- +1–2 recovered deals/month from the same proposal volume
- 10–15 days faster from "yes" → cash collected

At your ACV (~${formatCurrency(Y)}):
- +1 deal/month = +${formatCurrency(oneDealValue)}/month ≈ ${formatCurrency(annualOneDeal)}/year
- +2 deals/month = +${formatCurrency(twoDealsValue)}/month ≈ ${formatCurrency(annualTwoDeals)}/year

Elystra is $1,500/month.

If Elystra only helps you claw back 1 extra serious deal/month, your net after paying us is roughly ${formatCurrency(netOneDeal)}. At 2 extra deals/month, you're closer to ${formatCurrency(netTwoDeals)} in net lift.

You're not buying software. You're deciding whether to keep burning those 1–2 deals every month, or not.

What Elystra actually changes:
1. Proposal Clone + Engine — Same structure, same pricing logic, rebuilt in minutes. Zero admin, no Canva versioning.
2. Sign → Pay in one rail — Client signs and pays in same motion. No 20-30 day finance delays, no invoice chasing.
3. X-Ray on every deal — Who opened, which sections they read, where interest dies. Surgical follow-ups.
4. Behavior-based follow-ups — Nudges when pricing viewed but not signed, signed but not paid. That's where 1-2 extra closes come from.

How we wire it: We configure your proposal structure, pricing logic, payment methods, integrations, email tone, seats/permissions. $1,500/month includes 2 seats. Additional seats $250/seat. Elystra adapts to how you sell.

Here's the deal: Run Elystra on your next 5-10 serious proposals for 30 days. If deals don't close at a higher rate and don't pull cash faster, we refund the month. No forms, no negotiation.

Binary next step:
Let us know your stand within the next 2 days. Then: spin up account, mirror structure + pricing, wire payment + integrations, run first live deal through Elystra this week.

If this isn't a priority, let us know and we close your file instead of dragging this out.

-- David, Elystra`;

    return {
      subject: `${name}, quick recap in numbers`,
      html: wrapHtml(html),
      text,
    };
  }

  /**
   * Touch 2 (Day 2): Internal politics + one-proposal test
   * Arm the champion to win the internal fight.
   */
  static internalPolitics(prospect: Prospect): EmailTemplate {
    const name = firstName(prospect);
    const roi = calculateROI(prospect);
    const X = prospect.proposals_per_month;
    const Y = prospect.avg_deal_size;
    const Z = prospect.close_rate;
    const D = prospect.time_to_cash_days;
    const dealsDying = X * (1 - Z / 100);
    const agencyLink = prospect.agency_proposal_link || process.env.ELYSTRA_AGENCY_PROPOSAL_LINK || prospect.pricing_page_url;

    return {
      subject: `${name} — internal team version + proposal link`,
      html: wrapHtml(`
<p>Hey ${name},</p>

<p>You'd need to loop in your internal team. Here's the clean version of the story for them:</p>

<ol>
  <li>We're sending ~${X} proposals/month at ~${formatCurrency(Y)} each.</li>
  <li>We're closing roughly ${Z}%, which leaves ${dealsDying.toFixed(0)} deals/month dying after proposal.</li>
  <li>Cash from "yes" lands ~${D} days later.</li>
</ol>

<p>Elystra sits exactly on that sales rail:</p>
<ul class="recap">
  <li>Turns our proposals into tracked, interactive offers</li>
  <li>Ties signatures + payment into the same flow</li>
  <li>Shows precisely where deals die and who owes what, by when</li>
</ul>

<p>Conservatively, if Elystra only recovers 1–2 deals/month and pulls cash in 10 days faster, it pays for itself several times over.</p>

<p>If it helps, you can forward this straight to your partner or owner with something like:</p>

<div class="numbers-box">
  "We're leaking roughly ${formatCurrency(roi.annual_revenue_gap)}/year between proposals that die and slow collections. Elystra plugs that rail. I'd like to run our next proposal through it and see impact on one deal."
</div>

<p>To make it real on your side, here's your agency-plan Elystra link:</p>
<p><a href="${agencyLink}" class="cta">Create One Live Proposal</a></p>
<p style="font-size: 13px; color: #666;">— lets you create one live proposal on your current pipeline so you can feel the system instead of imagining it.</p>

<p>If you want us on the internal call with your partner or owner, send me two time options this week when you're both available and we'll do a 20-minute, numbers-only review.</p>

<p>-- David, Elystra</p>
      `),
      text: `Hey ${name},

If you want to loop in your internal team, here's the clean version of the story for them:

1. We're sending ~${X} proposals/month at ~${formatCurrency(Y)} each.
2. We're closing roughly ${Z}%, which leaves ${dealsDying.toFixed(0)} deals/month dying after proposal.
3. Cash from "yes" lands ~${D} days later.

Elystra sits exactly on that sales rail:
- Turns our proposals into tracked, interactive offers
- Ties signatures + payment into the same flow
- Shows precisely where deals die and who owes what, by when


If it helps, you can forward this straight to your partner or owner with something like:


To make it real on your side, here's your agency-plan Elystra link:
${agencyLink}
— lets you create one live proposal on your current pipeline so you can feel the system instead of imagining it. if you need us to provide  a Demo Recoded Video, let us know. 

If you want us on the internal call with your partner or owner, send me two time options this week when you're both available and we'll do a 20-minute, numbers-only review.

-- David, Elystra`,
    };
  }

  /**
   * Touch 3 (Day 5): Policy decision — infrastructure choice, not "checking in"
   */
  static directAsk(prospect: Prospect): EmailTemplate {
    const name = firstName(prospect);
    const roi = calculateROI(prospect);
    const X = prospect.proposals_per_month;
    const Y = prospect.avg_deal_size;
    const Z = prospect.close_rate;
    const D = prospect.time_to_cash_days;
    const monthlyDeltaOneDeal = Y;
    const monthlyDeltaTwoDeals = 2 * Y;

    return {
      subject: `This is now a policy decision, not a software question`,
      html: wrapHtml(`
<p>Hey ${name},</p>

<p>Let's remove the fog and talk in the only language that matters: your numbers.</p>

<p>From your own inputs:</p>
<ul class="recap">
  <li>Proposals/month: ~${X}</li>
  <li>Avg deal size: ~${formatCurrency(Y)}</li>
  <li>Close rate after proposal: ~${Z}%</li>
  <li>Time from "yes" → cash: ~${D} days</li>
</ul>

<p>That translates into:</p>
<ul class="recap">
  <li>≈ ${formatCurrency(roi.monthly_revenue_gap)}/month leaking after proposals go out</li>
  <li>≈ ${formatCurrency(roi.annual_revenue_gap)}/year in deals that should be cash but die in follow-up, signatures and payment friction</li>
</ul>

<p>That's not my math. That is your pipeline, with your numbers, made visible.</p>

<hr class="sep">

<h3>What Elystra actually does in that context</h3>

<p>You saw it live:</p>
<ul class="recap">
  <li>Same proposals you send today — same structure, same pricing logic, same narrative — but generated in minutes instead of hours, and run on a rail where:</li>
  <li>Sign → Pay is one motion. No "we'll get this to finance", no invoices floating around for 30 days.</li>
  <li>Behavior is tracked. You see who opened, who read pricing, where interest dies.</li>
  <li>Follow-ups fire on behavior, not memory. Pricing viewed, not signed? Signed, not paid? Elystra pushes automatically.</li>
</ul>

<p>Pessimistic outcome (not "best case", just physics):</p>
<ul class="recap">
  <li>+1–2 serious deals/month recovered from the same proposal volume</li>
  <li>10–15 days faster from "yes" → cash collected</li>
</ul>

<p>At your ACV, that's:</p>
<ul class="recap">
  <li>≈ ${formatCurrency(monthlyDeltaOneDeal)}–${formatCurrency(monthlyDeltaTwoDeals)} extra per month</li>
  <li>For a $1.5K/month rail.</li>
</ul>

<p>If we're wrong, you have the 30-day guarantee. You walk, you keep your current leaks.<br>
If we're right, you're effectively paying $1.5K to unlock ${formatCurrency(monthlyDeltaOneDeal)}–${formatCurrency(monthlyDeltaTwoDeals)} every month going forward.</p>

<hr class="sep">

<h3>This is the actual decision in front of you</h3>

<p>It's not "Do we like Elystra?"<br>
It's:</p>

<p><strong>Do we accept leaking ${formatCurrency(roi.monthly_revenue_gap)}/month, ${formatCurrency(roi.annual_revenue_gap)}/year as a structural fact of how we sell, or do we wire a dedicated rail to stop it?</strong></p>

<p>Both are valid choices. But they are conscious choices now, not accidental.</p>

<p><strong>We need a clear stance</strong></p>
<ul class="recap">
  <li><strong>Reply YES</strong> → We configure Elystra around how you sell (proposal structure, pricing logic, payment methods, roles/permissions) and run your next live proposals through it this week.</li>
  <li><strong>Reply NO</strong> → We close your file on our side and reallocate the slot to teams who are ready to tighten their rail now.</li>
</ul>

<p>You've seen the system. You've seen the math.<br>
Now it's simply: run your deals through Elystra and stop the bleed, or keep your current rail and accept the leak.</p>

<p>-- David<br>
Founder, Elystra</p>
      `),
      text: `Hey ${name},

Let's remove the fog and talk in the only language that matters: your numbers.

From your own inputs:
- Proposals/month: ~${X}
- Avg deal size: ~${formatCurrency(Y)}
- Close rate after proposal: ~${Z}%
- Time from "yes" → cash: ~${D} days

That translates into:
- ≈ ${formatCurrency(roi.monthly_revenue_gap)}/month leaking after proposals go out
- ≈ ${formatCurrency(roi.annual_revenue_gap)}/year in deals that should be cash but die in follow-up, signatures and payment friction

That's not my math. That is your pipeline, with your numbers, made visible.

What Elystra actually does: Same proposals, same structure — but Sign→Pay in one motion, behavior tracked, follow-ups on behavior. Pessimistic: +1-2 deals/month, 10-15 days faster. At your ACV: ≈ ${formatCurrency(monthlyDeltaOneDeal)}–${formatCurrency(monthlyDeltaTwoDeals)} extra/month for $1.5K. 30-day guarantee if we're wrong.

This is the actual decision: Do we accept leaking ${formatCurrency(roi.monthly_revenue_gap)}/month as structural fact, or wire a rail to stop it? Both valid. Both conscious now.

We need a clear stance:
- Reply YES → We configure Elystra and run your next live proposals through it this week.
- Reply NO → We close your file on our side and reallocate the slot.

You've seen the system. You've seen the math. Run deals through Elystra and stop the bleed, or keep your current rail and accept the leak.

-- David, Founder, Elystra`,
    };
  }

  /**
   * Touch 4 (Day 10): Close the file on our side for this quarter
   */
  static closingFile(prospect: Prospect): EmailTemplate {
    const name = firstName(prospect);
    const roi = calculateROI(prospect);

    return {
      subject: `Closing your file for this quarter, ${name}`,
      html: wrapHtml(`
<p>${name},</p>

<p>We're closing your file on our side for this quarter.</p>

<p>The numbers haven't changed — <strong>${formatCurrency(roi.monthly_revenue_gap)}/month</strong> stays on the table. That's the math.</p>

<p>If you want to move forward in the next 48 hours, reply to this email. After that, we're closed on this for the quarter.</p>

<p>No follow-up after this. I appreciate your time, ${name}.</p>

<p>-- David, Elystra</p>
      `),
      text: `${name},

We're closing your file on our side for this quarter.

The numbers haven't changed — ${formatCurrency(roi.monthly_revenue_gap)}/month stays on the table. That's the math.

If you want to move forward in the next 48 hours, reply. After that, we're closed on this for the quarter.

No follow-up after this. Appreciate your time.

-- David, Elystra`,
    };
  }
}
