import { Resend } from "resend";

/**
 * Transactional email via Resend. All functions are safe no-ops when the
 * service isn't configured (no API key / no recipients), so local development
 * and CI work without email. Configure with:
 *
 *   RESEND_API_KEY   — from https://resend.com/api-keys
 *   RESEND_FROM      — sender address, e.g. "Family Tree <tree@yourdomain.com>"
 *                      (defaults to Resend's onboarding sandbox address)
 *   ADMIN_EMAILS     — comma-separated recipients for admin notifications
 *                      (already used for role assignment in /api/claim)
 */

function env() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "Family Tree <onboarding@resend.dev>";
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return { apiKey, from, adminEmails };
}

let resendClient: Resend | null = null;
function getClient(apiKey: string): Resend {
  if (!resendClient) resendClient = new Resend(apiKey);
  return resendClient;
}

export type PendingNotification = {
  personName: string;
  requestType: string; // ADD_PERSON | ADD_CHILD_LINK | EDIT_PERSON
  submittedBy?: string | null;
  adminUrl: string; // link to the moderation queue
};

/**
 * Email every admin that a new entry is waiting for review.
 * Never throws — failures are logged so the submission flow is unaffected.
 */
export async function notifyAdminsOfPending(info: PendingNotification): Promise<void> {
  const { apiKey, from, adminEmails } = env();
  if (!apiKey) {
    console.warn(
      "[email] RESEND_API_KEY not set — skipping admin notification for",
      info.personName
    );
    return;
  }
  if (adminEmails.length === 0) {
    console.warn(
      "[email] ADMIN_EMAILS not set — skipping admin notification for",
      info.personName
    );
    return;
  }

  const subject = `New pending entry: ${info.personName}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="margin-bottom: 4px;">New entry awaiting approval</h2>
      <p style="color: #666; margin-top: 0;">A member added someone new to the family tree.</p>
      <table style="border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 4px 16px 4px 0; color: #666;">Person</td>
            <td style="padding: 4px 0; font-weight: 600;">${escapeHtml(info.personName)}</td></tr>
        <tr><td style="padding: 4px 16px 4px 0; color: #666;">Request</td>
            <td style="padding: 4px 0;">${escapeHtml(info.requestType)}</td></tr>
        ${
          info.submittedBy
            ? `<tr><td style="padding: 4px 16px 4px 0; color: #666;">Submitted by</td>
                 <td style="padding: 4px 0;">${escapeHtml(info.submittedBy)}</td></tr>`
            : ""
        }
      </table>
      <a href="${escapeHtml(info.adminUrl)}"
         style="display: inline-block; background: #123f8c; color: #ffffff;
                padding: 10px 20px; border-radius: 10px; text-decoration: none;
                font-weight: 600;">
        Review in moderation queue
      </a>
    </div>
  `;

  try {
    const { data, error } = await getClient(apiKey).emails.send({
      from,
      to: adminEmails,
      subject,
      html,
    });
    if (error) {
      console.error("[email] Resend failed to send admin notification:", error);
    } else {
      console.log("[email] Admin notification sent:", data?.id, "->", adminEmails);
    }
  } catch (err) {
    console.error("[email] Unexpected error sending admin notification:", err);
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
