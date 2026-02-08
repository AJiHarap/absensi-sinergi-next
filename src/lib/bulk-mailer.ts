import { sendEmail } from './mailer'

interface BulkEmailParams {
  recipients: string[]
  subject: string
  html?: string
  text?: string
  attachments?: { filename: string; content: Buffer; contentType?: string; cid?: string; contentDisposition?: 'attachment' | 'inline' }[]
  batchSize?: number
  delayBetweenBatches?: number
}

export async function sendBulkEmail(params: BulkEmailParams) {
  const {
    recipients,
    subject,
    html,
    text,
    attachments,
    batchSize = 20, // Send 20 emails per batch
    delayBetweenBatches = 1000 // 1 second delay between batches
  } = params

  const results = {
    success: [] as string[],
    failed: [] as { email: string; error: string }[],
    total: recipients.length,
    startTime: new Date()
  }

  console.log(`📧 Starting bulk email to ${recipients.length} recipients...`)
  console.log(`📊 Batch size: ${batchSize}, Delay: ${delayBetweenBatches}ms`)

  // Process emails in batches
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize)
    const batchNumber = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(recipients.length / batchSize)

    console.log(`🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} emails)...`)

    // Send emails in parallel within batch
    const batchPromises = batch.map(async (email) => {
      try {
        await sendEmail({
          to: email,
          subject,
          html,
          text,
          attachments
        })
        results.success.push(email)
        console.log(`✅ Sent to: ${email}`)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        results.failed.push({ email, error: errorMsg })
        console.error(`❌ Failed to send to ${email}: ${errorMsg}`)
      }
    })

    // Wait for current batch to complete
    await Promise.all(batchPromises)

    // Add delay between batches (except for last batch)
    if (i + batchSize < recipients.length) {
      console.log(`⏱️ Waiting ${delayBetweenBatches}ms before next batch...`)
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches))
    }
  }

  const endTime = new Date()
  const duration = endTime.getTime() - results.startTime.getTime()

  console.log(`\n📊 Bulk Email Summary:`)
  console.log(`✅ Success: ${results.success.length}`)
  console.log(`❌ Failed: ${results.failed.length}`)
  console.log(`⏱️ Duration: ${(duration / 1000).toFixed(2)} seconds`)
  console.log(`🚀 Average: ${(duration / recipients.length).toFixed(0)}ms per email`)

  if (results.failed.length > 0) {
    console.log('\n❌ Failed Recipients:')
    results.failed.forEach(({ email, error }) => {
      console.log(`  - ${email}: ${error}`)
    })
  }

  return results
}

// Helper function to validate email list
export function validateEmailList(emails: string[]): { valid: string[]; invalid: string[] } {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  
  const valid = emails.filter(email => emailRegex.test(email))
  const invalid = emails.filter(email => !emailRegex.test(email))

  if (invalid.length > 0) {
    console.warn(`⚠️ Found ${invalid.length} invalid email addresses:`)
    invalid.forEach(email => console.warn(`  - ${email}`))
  }

  return { valid, invalid }
}
