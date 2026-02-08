import { sendEmail } from './mailer'
import { gmailRateLimiter } from './rate-limiter'

interface FastBulkEmailParams {
  recipients: string[]
  subject: string
  html?: string
  text?: string
  attachments?: { filename: string; content: Buffer; contentType?: string; cid?: string; contentDisposition?: 'attachment' | 'inline' }[]
  concurrency?: number // Jumlah email yang dikirim bersamaan
}

export async function sendFastBulkEmail(params: FastBulkEmailParams) {
  const {
    recipients,
    subject,
    html,
    text,
    attachments,
    concurrency = 5 // Default 5 email bersamaan
  } = params

  const results = {
    success: [] as string[],
    failed: [] as { email: string; error: string }[],
    total: recipients.length,
    startTime: new Date()
  }

  console.log(`🚀 Starting FAST bulk email to ${recipients.length} recipients...`)
  console.log(`⚡ Concurrency: ${concurrency} emails simultaneously`)
  console.log(`⏱️ Cooldown: 3 seconds between batches`)

  // Split recipients into chunks for concurrent processing
  const chunks = []
  for (let i = 0; i < recipients.length; i += concurrency) {
    chunks.push(recipients.slice(i, i + concurrency))
  }

  let processedCount = 0

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex]
    const progress = Math.round(((chunkIndex * concurrency + chunk.length) / recipients.length) * 100)
    
    console.log(`🔄 [${progress}%] Processing chunk ${chunkIndex + 1}/${chunks.length} (${chunk.length} emails)...`)

    // Send emails in parallel within chunk
    const chunkPromises = chunk.map(async (email) => {
      try {
        // Check rate limit before sending
        await gmailRateLimiter.waitForSlot()
        
        const startTime = Date.now()
        
        await sendEmail({
          to: email,
          subject,
          html,
          text,
          attachments
        })
        
        // Record successful send
        gmailRateLimiter.recordSent()
        
        const sendTime = Date.now() - startTime
        const stats = gmailRateLimiter.getStats()
        
        results.success.push(email)
        processedCount++
        
        console.log(`✅ [${Math.round((processedCount / recipients.length) * 100)}%] Sent to ${email} - ${sendTime}ms (${stats.sentToday}/day)`)
        
        return { success: true, email, time: sendTime }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        
        // Check if it's a rate limit error
        if (errorMsg.includes('limit exceeded') || errorMsg.includes('Daily user sending limit exceeded')) {
          console.log(`🚨 Gmail limit reached for ${email}: ${errorMsg}`)
          console.log(`⏸️ FAST bulk email stopped due to Gmail limits`)
          results.failed.push({ email, error: `GMAIL_LIMIT: ${errorMsg}` })
          throw new Error('GMAIL_LIMIT_REACHED') // Stop processing
        } else {
          console.log(`❌ Failed to send to ${email}: ${errorMsg}`)
          results.failed.push({ email, error: errorMsg })
          return { success: false, email, error: errorMsg }
        }
      }
    })

    try {
      // Wait for current chunk to complete
      await Promise.all(chunkPromises)
    } catch (error) {
      if (error instanceof Error && error.message === 'GMAIL_LIMIT_REACHED') {
        break // Stop processing if Gmail limit reached
      }
    }

    // Small delay between chunks to prevent overwhelming
    if (chunkIndex < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second delay between chunks
    }
  }

  const endTime = new Date()
  const duration = endTime.getTime() - results.startTime.getTime()

  console.log(`\n🚀 FAST Bulk Email Summary:`)
  console.log(`✅ Success: ${results.success.length}`)
  console.log(`❌ Failed: ${results.failed.length}`)
  console.log(`⏱️ Duration: ${(duration / 1000).toFixed(2)} seconds`)
  console.log(`🚀 Average: ${(duration / recipients.length).toFixed(0)}ms per email`)
  console.log(`📊 Speed: ${(results.success.length / (duration / 1000)).toFixed(1)} emails/second`)

  if (results.failed.length > 0) {
    console.log('\n❌ Failed Recipients:')
    results.failed.forEach(({ email, error }) => {
      console.log(`  - ${email}: ${error}`)
    })
  }

  return results
}

// Helper function untuk estimate waktu
export function estimateSendTime(emailCount: number, concurrency = 5): {
  estimatedSeconds: number
  estimatedMinutes: number
  emailsPerSecond: number
} {
  const cooldownSeconds = 3
  const chunkSize = concurrency
  const chunks = Math.ceil(emailCount / chunkSize)
  
  // Setiap chunk: chunkSize emails + 3 detik cooldown
  const estimatedSeconds = (chunks * cooldownSeconds) + (emailCount * 0.5) // 0.5 detik per email untuk processing
  const emailsPerSecond = emailCount / estimatedSeconds
  
  return {
    estimatedSeconds,
    estimatedMinutes: estimatedSeconds / 60,
    emailsPerSecond
  }
}
