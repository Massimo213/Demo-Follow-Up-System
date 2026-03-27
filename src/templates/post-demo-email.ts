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

/** Day 1 email: per-prospect links, else Vercel env defaults */
function assessmentWorkspaceLinks(prospect: Prospect): { assessment: string; workspace: string } {
  const assessment =
    prospect.assessment_link?.trim() ||
    process.env.ELYSTRA_DEFAULT_ASSESSMENT_LINK?.trim() ||
    '';
  const workspace =
    prospect.workspace_link?.trim() ||
    process.env.ELYSTRA_DEFAULT_WORKSPACE_LINK?.trim() ||
    '';
  return { assessment, workspace };
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
      PD_INTERNAL_CALL_REMINDER: () => this.internalCallReminder(prospect),
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
   * Day 1: Internal decision path — assessment + workspace links
   */
  static internalPolitics(prospect: Prospect): EmailTemplate {
    const name = firstName(prospect);
    const { assessment, workspace } = assessmentWorkspaceLinks(prospect);

    const assessmentHtml = assessment
      ? `<a href="${assessment}">${assessment}</a>`
      : `<span class="muted">(same link as in your Day 0 email, reply if you need it resent)</span>`;
    const workspaceHtml = workspace
      ? `<a href="${workspace}">${workspace}</a>`
      : `<span class="muted">(same link as in your Day 0 email, reply if you need it resent)</span>`;

    const assessmentText = assessment || '(same link as Day 0, reply if you need it resent)';
    const workspaceText = workspace || '(same link as Day 0, reply if you need it resent)';

    return {
      subject: `Internal decision path`,
      html: wrapHtml(`
<p>Hi ${name},</p>

<p>You now have both pieces on your side:</p>

<p><strong>Revenue Infrastructure Assessment:</strong> ${assessmentHtml}<br>
<strong>Private Elystra Evaluation Workspace:</strong> ${workspaceHtml}</p>

<p>The assessment gives you the business case.<br>
The workspace gives you the live proof.</p>

<p>So the only useful question at this point is: what does the decision path actually look like on your side?</p>

<p>If there is anything we have not answered clearly yet, send it over and we will address it directly.</p>

<p>If another person needs to review this with you, let us know as soon as possible and we can keep the next call focused on:</p>
<p>
- where the current rail is leaking<br>
- what Elystra changes operationally<br>
- what the delta looks like once the rail is installed properly<br>
- and what activation would look like on your side
</p>

<p>If something else is holding movement up, make that clear as well so we can both attack it correctly.</p>

<p>David from Elystra</p>
      `),
      text: `Hi ${name},

You now have both pieces on your side:

Revenue Infrastructure Assessment: ${assessmentText}
Private Elystra Evaluation Workspace: ${workspaceText}

The assessment gives you the business case.
The workspace gives you the live proof.

So the only useful question at this point is: what does the decision path actually look like on your side?

If there is anything we have not answered clearly yet, send it over and we will address it directly.

If another person needs to review this with you, let us know as soon as possible and we can keep the next call focused on:
- where the current rail is leaking
- what Elystra changes operationally
- what the delta looks like once the rail is installed properly
- and what activation would look like on your side

If something else is holding movement up, make that clear as well so we can both attack it correctly.

David from Elystra`,
    };
  }

  /**
   * Touch (Day 3): Blocker-extraction compression
   */
  static directAsk(prospect: Prospect): EmailTemplate {
    const name = firstName(prospect);

    return {
      subject: `What is the blocker on your side?`,
      html: wrapHtml(`
<p>Hi ${name},</p>

<p>You've now had the Revenue Infrastructure Assessment and the private Elystra evaluation workspace on your side for a few days.</p>

<p>At this point, if things have still not moved, then there is likely a blocker on your side, whether that is internal review, timing, implementation concern, pricing, or something else.</p>

<p>If there is one, say it directly.<br>
We would rather understand the real blocker than let the decision sit in silence.</p>

<p>The reason we sent both the assessment and the workspace is simple:</p>
<p>
- the assessment shows the business case<br>
- the workspace shows the rail in context<br>
- together, they are meant to make the decision clearer, not heavier
</p>

<p>For agencies like yours, the objective is not abstract. The usual win is straightforward: get more of the existing pipeline to turn into paid revenue, get proposals moving before momentum dies, stop letting competitors slip back into the gap, and create enough control over the sales motion that one or two additional deals in the first month becomes realistic.</p>

<p>That is the delta we are trying to create.</p>

<p>So the cleanest next step is this:</p>

<p>reply with the blocker, or send two times that work for a short follow-up review and we'll keep it focused.</p>

<p>Best,<br>
David from Elystra</p>
      `),
      text: `Hi ${name},

You've now had the Revenue Infrastructure Assessment and the private Elystra evaluation workspace on your side for a few days.

At this point, if things have still not moved, then there is likely a blocker on your side, whether that is internal review, timing, implementation concern, pricing, or something else.

If there is one, inform us directly.
We would rather understand the real blocker than let the decision sit in silence.

The reason we sent both the assessment and the workspace is simple:
- the assessment shows the business case
- the workspace shows the rail in context
- together, they are meant to make the decision clearer, not heavier

For agencies like yours, the objective is not abstract. The usual win is straightforward: get more of the existing pipeline to turn into paid revenue, get proposals moving before momentum dies, stop letting competitors slip back into the gap, and create enough control over the sales motion that one or two additional deals in the first month becomes realistic.

That is the delta we are trying to create.

So the cleanest next step is this:

reply with the blocker, or send two times that work for a short follow-up review and we'll keep it focused.

Best,
David from Elystra`,
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

<p>David from Elystra</p>
      `),
      text: `${name},

We are going to close the file on our side for now. The Infrastructure Assessment stands.

The underlying issue itself has not changed, leaking through the same revenue rail.

If you want to activate before we close it fully, use the link below in the next 48 hours.

${pricingLink}

If not, we leave it there cleanly.

David from Elystra`,
    };
  }

  /**
   * Day 2: Internal reminder to call the prospect.
   */
  static internalCallReminder(prospect: Prospect): EmailTemplate {
    const name = firstName(prospect);
    const phone = prospect.phone?.trim() || 'No phone on file';

    return {
      subject: `Call today, ${prospect.agency_name}, ${name}`,
      html: wrapHtml(`
<p>Call reminder for today.</p>

<p>This prospect is at the Day 2 founder call step.</p>

<p>
- Who: ${prospect.name}<br>
- Agency: ${prospect.agency_name}<br>
- Phone: ${phone}<br>
- Email: ${prospect.email}<br>
- Demo date: ${prospect.demo_date}
</p>

<p>Action: call the prospect today. If they do not answer, leave a short voicemail, then the missed-call SMS will handle the follow-up.</p>

<p>David from Elystra</p>
      `),
      text: `Call reminder for today.

This prospect is at the Day 2 founder call step.

- Who: ${prospect.name}
- Agency: ${prospect.agency_name}
- Phone: ${phone}
- Email: ${prospect.email}
- Demo date: ${prospect.demo_date}

Action: call the prospect today. If they do not answer, leave a short voicemail, then the missed-call SMS will handle the follow-up.

David from Elystra`,
    };
  }
}
