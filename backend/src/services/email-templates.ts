export function verificationEmail(params: { name: string; actionUrl: string }): { subject: string; text: string; html: string } {
  return {
    subject: 'Verify your Operations Portal account',
    text: [
      `Hi ${params.name},`,
      '',
      'Confirm your email address to finish creating your Operations Portal account.',
      params.actionUrl,
      '',
      'This link expires in 24 hours. If you did not create an account, you can ignore this email.',
    ].join('\n'),
    html: layout({
      heading: 'Verify your email',
      intro: `Hi ${escapeHtml(params.name)}, confirm your email address to finish creating your Operations Portal account.`,
      actionLabel: 'Verify email',
      actionUrl: params.actionUrl,
      footer: 'This link expires in 24 hours. If you did not create an account, you can ignore this email.',
    }),
  };
}

export function passwordResetEmail(params: { name: string; actionUrl: string }): { subject: string; text: string; html: string } {
  return {
    subject: 'Reset your Operations Portal password',
    text: [
      `Hi ${params.name},`,
      '',
      'Use the link below to choose a new password. If you did not request a reset, you can ignore this email.',
      params.actionUrl,
      '',
      'This link expires in 1 hour and can be used only once.',
    ].join('\n'),
    html: layout({
      heading: 'Reset your password',
      intro: `Hi ${escapeHtml(params.name)}, use the button below to choose a new password.`,
      actionLabel: 'Reset password',
      actionUrl: params.actionUrl,
      footer: 'This link expires in 1 hour and can be used only once. If you did not request a reset, you can ignore this email.',
    }),
  };
}

function layout(params: {
  heading: string;
  intro: string;
  actionLabel: string;
  actionUrl: string;
  footer: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#F7F4EF;font-family:Arial,sans-serif;color:#1C1917;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #E7E0D6;border-radius:8px;">
      <tr>
        <td style="padding:28px;">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#57534E;">Operations Portal</p>
          <h1 style="margin:0 0 16px;font-size:22px;">${escapeHtml(params.heading)}</h1>
          <p style="margin:0 0 20px;line-height:1.5;">${params.intro}</p>
          <p style="margin:0 0 24px;">
            <a href="${escapeHtml(params.actionUrl)}" style="display:inline-block;background:#1B4332;color:#FFFFFF;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600;">${escapeHtml(params.actionLabel)}</a>
          </p>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#57534E;">${escapeHtml(params.footer)}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
