import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || "Daily Agent <noreply@dailyagent.dev>";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set, skipping email:", subject);
    return;
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("Failed to send email:", error);
    }
  } catch (err) {
    console.error("Email send error:", err);
  }
}

// --- Email Templates ---

export async function sendWelcomeEmail(to: string, displayName: string) {
  await sendEmail({
    to,
    subject: "Welcome to Daily Agent",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 16px;">Welcome to Daily Agent, ${displayName}!</h1>
        <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          Your productivity dashboard is ready. Start by adding your first tasks, habits, and goals — then connect your AI client via MCP for the full experience.
        </p>
        <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          Here's what you can do:
        </p>
        <ul style="color: #666; font-size: 16px; line-height: 1.8; margin-bottom: 24px; padding-left: 20px;">
          <li>Manage tasks with Franklin Covey priorities</li>
          <li>Track habits and build streaks</li>
          <li>Write daily journal entries</li>
          <li>Log workouts and track progress</li>
          <li>Set goals and monitor progress</li>
          <li>Connect Claude or ChatGPT via MCP</li>
        </ul>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://dailyagent.dev'}/dashboard"
           style="display: inline-block; background: #d4a574; color: #1a1a1a; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          Go to Dashboard
        </a>
        <p style="color: #999; font-size: 13px; margin-top: 32px;">
          — The Daily Agent Team
        </p>
      </div>
    `,
  });
}

export async function sendSubscriptionActivatedEmail(to: string, displayName: string) {
  await sendEmail({
    to,
    subject: "Daily Agent Pro — You're in!",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 16px;">Welcome to Pro, ${displayName}!</h1>
        <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          You now have full access to Daily Agent Pro. Here's what's unlocked:
        </p>
        <ul style="color: #666; font-size: 16px; line-height: 1.8; margin-bottom: 24px; padding-left: 20px;">
          <li>Full MCP write access — Claude can create, update, and manage your data</li>
          <li>All MCP prompt templates — daily planning, weekly reviews, habit analysis, and more</li>
          <li>Unlimited API keys</li>
          <li>10,000 MCP requests per day</li>
          <li>Data export (JSON/CSV)</li>
        </ul>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://dailyagent.dev'}/dashboard"
           style="display: inline-block; background: #d4a574; color: #1a1a1a; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          Go to Dashboard
        </a>
        <p style="color: #999; font-size: 13px; margin-top: 32px;">
          — The Daily Agent Team
        </p>
      </div>
    `,
  });
}

export async function sendPaymentFailedEmail(to: string, displayName: string) {
  await sendEmail({
    to,
    subject: "Daily Agent — Payment failed",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 16px;">Payment issue, ${displayName}</h1>
        <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          We couldn't process your latest payment for Daily Agent Pro. Please update your payment method to keep your Pro access.
        </p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://dailyagent.dev'}/settings"
           style="display: inline-block; background: #d4a574; color: #1a1a1a; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          Update Payment Method
        </a>
        <p style="color: #999; font-size: 13px; margin-top: 32px;">
          — The Daily Agent Team
        </p>
      </div>
    `,
  });
}

export async function sendSubscriptionCanceledEmail(to: string, displayName: string) {
  await sendEmail({
    to,
    subject: "Daily Agent Pro — Subscription canceled",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 16px;">We're sorry to see you go, ${displayName}</h1>
        <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          Your Pro subscription has been canceled. Your data is safe — you can still access everything on the free plan via the dashboard.
        </p>
        <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          If you change your mind, you can resubscribe anytime from your settings.
        </p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://dailyagent.dev'}/settings"
           style="display: inline-block; background: #d4a574; color: #1a1a1a; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          Resubscribe
        </a>
        <p style="color: #999; font-size: 13px; margin-top: 32px;">
          — The Daily Agent Team
        </p>
      </div>
    `,
  });
}

export async function sendAccountDeletedEmail(to: string, displayName: string) {
  await sendEmail({
    to,
    subject: "Daily Agent — Account deleted",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 16px;">Account deleted</h1>
        <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          Your Daily Agent account has been permanently deleted, ${displayName}. All your data has been removed.
        </p>
        <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          If this was a mistake, unfortunately we cannot recover your data. You're welcome to create a new account anytime.
        </p>
        <p style="color: #999; font-size: 13px; margin-top: 32px;">
          — The Daily Agent Team
        </p>
      </div>
    `,
  });
}
