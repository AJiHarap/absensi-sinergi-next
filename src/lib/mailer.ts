import nodemailer from 'nodemailer'

// Create a singleton transporter using Gmail SMTP
// Requires environment variables:
// - GMAIL_USER: your Gmail address
// - GMAIL_PASS: app password (recommended) or OAuth2 (not implemented here)
// - MAIL_FROM_NAME: optional display name

let transporter: nodemailer.Transporter | null = null

export function getMailer() {
  if (transporter) return transporter
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_PASS
  if (!user || !pass) {
    throw new Error('Missing GMAIL_USER/GMAIL_PASS in environment')
  }
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false
    },
    pool: true,
    maxConnections: 10, // Increased from 5
    maxMessages: 200, // Increased from 100
    rateDelta: 500, // Reduced from 1000ms
    rateLimit: 10 // Increased from 5 emails per second
  })
  return transporter
}

export async function sendEmail(params: {
  to: string
  subject: string
  html?: string
  text?: string
  attachments?: { filename: string; content: Buffer; contentType?: string; cid?: string; contentDisposition?: 'attachment' | 'inline' }[]
}) {
  const fromName = process.env.MAIL_FROM_NAME || 'Absensi Sinergi'
  const from = `${fromName} <${process.env.GMAIL_USER}>`
  const mailer = getMailer()
  
  // Anti-spam headers
  const headers = {
    'X-Priority': '3',
    'X-Mailer': 'Absensi Sinergi System',
    'X-MSMail-Priority': 'Normal',
    'X-MimeOLE': 'Produced By Absensi Sinergi',
    'List-Unsubscribe': `<mailto:${process.env.GMAIL_USER}?subject=unsubscribe>`,
    'Precedence': 'bulk',
    'X-Auto-Response-Suppress': 'All',
    'X-Original-To': params.to,
    'X-Delivered-To': params.to
  }

  const info = await mailer.sendMail({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text || params.html?.replace(/<[^>]*>/g, ''), // Auto-generate text from HTML
    attachments: params.attachments,
    headers
  })
  return info
}
