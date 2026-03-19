/**
 * Post-Demo Email Templates
 * 4-touch post-demo sequence.
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
    .forward-block { background: #f8f9fa; border: 1px solid #e2e8f0; padding: 20px; margin: 20px 0; font-style: italic; border-radius: 6px; }
    table.delta { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
    table.delta th, table.delta td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    table.delta th { background: #f8f9fa; font-weight: 600; }
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
    const X = prospect.proposals_per_month ?? 0;
    const Y = prospect.avg_deal_size ?? 0;
    const Z = prospect.close_rate ?? 0;
    const D = prospect.time_to_cash_days ?? 0;
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

<p>Good speaking today.</p>

<p>Attached is the Revenue Infrastructure Assessment built from the numbers and friction points we discussed on the demo.</p>

<p>It is not a generic recap. It is something you can actually use internally if this needs to be reviewed with a partner or anyone else on your side.</p>

<p>The assessment lays out, clearly:</p>
<ul class="recap">
  <li>where revenue is currently leaking in your sales motion,</li>
  <li>what Elystra changes operationally,</li>
  <li>what the Elystra Delta looks like across 170+ pipelines,</li>
  <li>and what the activation path looks like if you decide to move.</li>
</ul>

<p>Quick reminder of the numbers we mapped:</p>
<ul class="recap">
  <li>Proposals sent/month: ~${X}</li>
  <li>Avg deal size: ~${formatCurrency(Y)}</li>
  <li>Close rate after proposal: ~${Z}%</li>
  <li>Days from "yes" to cash in bank: ~${D}</li>
</ul>

<p>At those numbers, even a conservative Elystra Delta matters:</p>
<ul class="recap">
  <li>+1–2 recovered deals/month from the same proposal volume</li>
  <li>10–15 days faster from "yes" → cash collected</li>
</ul>

<p>At your ACV (~${formatCurrency(Y)}), that is roughly:</p>
<ul class="recap">
  <li>+1 deal/month = +${formatCurrency(oneDealValue)}/month ≈ ${formatCurrency(annualOneDeal)}/year</li>
  <li>+2 deals/month = +${formatCurrency(twoDealsValue)}/month ≈ ${formatCurrency(annualTwoDeals)}/year</li>
</ul>



<p>If it only helps you claw back 1 extra serious deal/month, your net after paying us is roughly ${formatCurrency(netOneDeal)}.<br>
At 2 extra deals/month, you're closer to ${formatCurrency(netTwoDeals)} in net lift.</p>

<p>If the assessment is directionally right on your side, the next step is simple: review it internally and let us know your stand.</p>

<p>-- David, Elystra</p>`;

    const text = `Hey ${name},

Good speaking today.

Attached is the Revenue Infrastructure Assessment built from the numbers and friction points we discussed on the demo.

It is not a generic recap. It is something you can actually use internally if this needs to be reviewed with a partner or anyone else on your side.

The assessment lays out clearly:
- where revenue is currently leaking in your sales motion
- what Elystra changes operationally
- what the Elystra Delta looks like across 170+ pipelines
- and what the activation path looks like if you decide to move

Quick reminder of the numbers we mapped:
- Proposals sent/month: ~${X}
- Avg deal size: ~${formatCurrency(Y)}
- Close rate after proposal: ~${Z}%
- Days from "yes" to cash in bank: ~${D}

At those numbers, even a conservative Elystra Delta matters:
- +1–2 recovered deals/month from the same proposal volume
- 10–15 days faster from "yes" → cash collected

At your ACV (~${formatCurrency(Y)}), that is roughly:
- +1 deal/month = +${formatCurrency(oneDealValue)}/month ≈ ${formatCurrency(annualOneDeal)}/year
- +2 deals/month = +${formatCurrency(twoDealsValue)}/month ≈ ${formatCurrency(annualTwoDeals)}/year


If it only helps you claw back 1 extra serious deal/month, your net after paying us is roughly ${formatCurrency(netOneDeal)}. At 2 extra deals/month, you're closer to ${formatCurrency(netTwoDeals)} in net lift.

If the assessment is directionally right on your side, the next step is simple: review it internally and let us know your stand.

-- David, Elystra`;

    return {
      subject: `Revenue Infrastructure Assessment for ${name}`,
      html: wrapHtml(html),
      text,
    };
  }

  /**
   * Touch 1 (Day 3): Decision path — they have the Assessment, what's next?
   */
  static internalPolitics(prospect: Prospect): EmailTemplate {
    const name = firstName(prospect);

    return {
      subject: `Decision path, ${name}`,
      html: wrapHtml(`
<p>Hey ${name},</p>

<p>You have the Revenue Infrastructure Assessment on your side now.</p>

<p>So the only useful question is: what does the decision path actually look like internally?</p>

<p>If this needs internal review, the cleanest next move is a short call with the relevant person and keep it strictly on:</p>
<ul class="recap">
  <li>the leakage</li>
  <li>the Elystra Delta</li>
  <li>the system live</li>
  <li>and the activation path</li>
</ul>

<p>If there are any blockers? Let us know.</p>

<p>Reply with 2 slots if you want to do that.</p>

<p>— David, Elystra</p>
      `),
      text: `Hey ${name},

You have the Revenue Infrastructure Assessment on your side now.

So the only useful question is: what does the decision path actually look like internally?

If this needs internal review, the cleanest next move is a short call with the relevant person and keep it strictly on:
- the leakage
- the Elystra Delta
- the system live
- and the activation path

If there are any blockers? Let us know.

Reply with 2 slots if you want to do that.

— David, Elystra`,
    };
  }

  /**
   * Touch 2 (Day 6): Policy decision — underlying math unchanged, 170-agency Delta
   */
  static directAsk(prospect: Prospect): EmailTemplate {
    const name = firstName(prospect);
    const agencyName = prospect.agency_name;
    const pricingLink = prospect.pricing_page_url?.trim() || 'https://app.elystra.online/pricing';

    return {
      subject: `The math hasn't changed, ${name}`,
      html: wrapHtml(`
<p>Hey ${name},</p>

<p>Since we spoke, the underlying math has not changed.</p>

<p>The same leakage is still sitting in the gap between buyer intent and collected cash.</p>

<p>That is the only decision in front of you now:</p>
<ul class="recap">
  <li>install infrastructure to tighten that rail</li>
  <li>or keep the current process and accept the leak as part of how the agency operates</li>
</ul>

<h3>Here's what 170 agencies saw after installing the rail:</h3>

<table class="delta">
  <tr><th>Metric</th><th>Before</th><th>After</th><th>Delta</th></tr>
  <tr><td>Proposal → Paid close rate</td><td>31%</td><td>49%</td><td>+18 pts</td></tr>
  <tr><td>Deals closed/month</td><td>6.2</td><td>9.8</td><td>+3.6</td></tr>
  <tr><td>Days "yes" → cash</td><td>30</td><td>15</td><td>-15 days</td></tr>
  <tr><td>ROI on Elystra fee</td><td>—</td><td>9–14×</td><td>Month 1</td></tr>
</table>

<p>That's the median. Not best-case.</p>

<hr class="sep">

<h3>This is now a policy decision:</h3>

<p>Either ${agencyName} installs infrastructure to capture the revenue it's already generating but failing to collect — or it accepts the current leak as a structural cost of doing business.</p>

<p>Both are valid. Both are now conscious.</p>

<p>If you're ready to activate: <a href="${pricingLink}" class="cta">Activate your rail →</a><br>
We configure in 1–3 days. First live deal runs through Elystra this week.</p>

<p>If timing is wrong, give me a date and I'll follow up then.<br>
Otherwise, I'll send one final note and close your file.</p>

<p>— David, Elystra</p>
      `),
      text: `Hey ${name},

Since we spoke, the underlying math has not changed.

The same leakage is still sitting in the gap between buyer intent and collected cash.

That is the only decision in front of you now:
• install infrastructure to tighten that rail
• or keep the current process and accept the leak as part of how the agency operates

Here's what 170 agencies saw after installing the rail:

Metric | Before | After | Delta
Proposal → Paid close rate | 31% | 49% | +18 pts
Deals closed/month | 6.2 | 9.8 | +3.6
Days "yes" → cash | 30 | 15 | -15 days
ROI on Elystra fee | — | 9–14× | Month 1

That's the median. Not best-case.

This is now a policy decision:

Either ${agencyName} installs infrastructure to capture the revenue it's already generating but failing to collect — or it accepts the current leak as a structural cost of doing business.

Both are valid. Both are now conscious.

If you're ready to activate: ${pricingLink}
We configure in 1–3 days. First live deal runs through Elystra this week.

If timing is wrong, give me a date and I'll follow up then.
Otherwise, I'll send one final note and close your file.

— David, Elystra`,
    };
  }

  /**
   * Touch 3 (Day 10): Close the file — finality, 48h window
   */
  static closingFile(prospect: Prospect): EmailTemplate {
    const name = firstName(prospect);
    const pricingLink = prospect.pricing_page_url?.trim() || 'https://app.elystra.online/pricing';

    return {
      subject: `Closing your file, ${name}`,
      html: wrapHtml(`
<p>${name},</p>

<p>We are going to close the file on our side for now. The Infrastructure Assessment stands.</p>

<p>The underlying issue itself has not changed, leaking through the same revenue rail.</p>

<p>If you want to activate before we close it fully, use the link below in the next 48 hours.</p>

<p><a href="${pricingLink}" class="cta">${pricingLink}</a></p>

<p>If not, we leave it there cleanly.</p>

<p>— David, Elystra</p>
      `),
      text: `${name},

We are going to close the file on our side for now. The Infrastructure Assessment stands.

The underlying issue itself has not changed, leaking through the same revenue rail.

If you want to activate before we close it fully, use the link below in the next 48 hours.

${pricingLink}

If not, we leave it there cleanly.

— David, Elystra`,
    };
  }
}
