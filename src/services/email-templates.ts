import type { SendNotificationParams } from './notification-provider'

const APP_NAME = process.env.APP_NAME ?? 'Amic-Academia'
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const BRAND_COLOR = '#2563eb'

function layout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f4f5">
    <tr><td align="center" style="padding:32px 16px">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%">
        <!-- Header -->
        <tr>
          <td style="background:${BRAND_COLOR};border-radius:8px 8px 0 0;padding:24px 32px">
            <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px">${APP_NAME}</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:32px 32px 24px;border-left:1px solid #e4e4e7;border-right:1px solid #e4e4e7">
            ${bodyHtml}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;border:1px solid #e4e4e7;border-top:none;border-radius:0 0 8px 8px;padding:16px 32px;text-align:center">
            <p style="margin:0;font-size:12px;color:#6b7280">
              Vous recevez cet email car vous êtes inscrit sur
              <a href="${APP_URL}" style="color:${BRAND_COLOR};text-decoration:none">${APP_NAME}</a>.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function h1(text: string) {
  return `<h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;line-height:1.3">${text}</h1>`
}

function p(text: string) {
  return `<p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6">${text}</p>`
}

function btn(label: string, href: string) {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0">
    <tr><td>
      <a href="${href}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none">${label}</a>
    </td></tr>
  </table>`
}

const TEMPLATES: Record<string, (params: SendNotificationParams) => { subject: string; html: string }> = {
  ACCOUNT_CREATED: (params) => ({
    subject: `Bienvenue sur ${APP_NAME} !`,
    html: layout(
      `Bienvenue sur ${APP_NAME}`,
      `${h1(`Bienvenue sur ${APP_NAME} !`)}
       ${p('Votre compte a été créé avec succès. Vous pouvez maintenant accéder à notre catalogue de formations et commencer votre apprentissage.')}
       ${btn('Accéder à la plateforme', `${APP_URL}/dashboard`)}
       ${p('Si vous n\'avez pas créé ce compte, ignorez cet email.')}`,
    ),
  }),

  PAYMENT_SUCCESS: (params) => ({
    subject: `Paiement confirmé — ${params.title}`,
    html: layout(
      'Paiement confirmé',
      `${h1('Paiement confirmé !')}
       ${p(params.body)}
       ${btn('Voir mes formations', `${APP_URL}/dashboard/formations`)}`,
    ),
  }),

  COURSE_ACCESS_GRANTED: (params) => ({
    subject: `Accès accordé — ${params.title}`,
    html: layout(
      'Accès à une formation accordé',
      `${h1(params.title)}
       ${p(params.body)}
       ${btn('Commencer la formation', `${APP_URL}/dashboard/formations`)}`,
    ),
  }),

  QUIZ_PASSED: (params) => ({
    subject: `Félicitations — ${params.title}`,
    html: layout(
      params.title,
      `${h1(params.title)}
       ${p(params.body)}
       ${p('Continuez sur votre lancée !')}
       ${btn('Voir ma progression', `${APP_URL}/dashboard/formations`)}`,
    ),
  }),

  CERTIFICATE_AVAILABLE: (params) => ({
    subject: `Votre certificat est disponible — ${APP_NAME}`,
    html: layout(
      'Certificat disponible',
      `${h1('Votre certificat est prêt !')}
       ${p(params.body)}
       ${btn('Télécharger mon certificat', `${APP_URL}/dashboard/certificats`)}`,
    ),
  }),

  NEW_COURSE: (params) => ({
    subject: `Nouvelle formation disponible — ${params.title}`,
    html: layout(
      'Nouvelle formation',
      `${h1('Une nouvelle formation est disponible !')}
       ${p(params.body)}
       ${btn('Découvrir la formation', `${APP_URL}/formations`)}`,
    ),
  }),
}

export function buildEmailContent(params: SendNotificationParams): { subject: string; html: string } {
  const tpl = TEMPLATES[params.event]
  if (tpl) return tpl(params)
  // Generic fallback for events without a specific template
  return {
    subject: params.title,
    html: layout(
      params.title,
      `${h1(params.title)}${p(params.body)}${btn('Accéder à la plateforme', APP_URL)}`,
    ),
  }
}
