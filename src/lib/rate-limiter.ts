// Rate limiter untuk menghindari Gmail daily limit exceeded
interface RateLimitConfig {
  maxPerHour: number
  maxPerDay: number
  cooldownMinutes: number
}

class RateLimiter {
  private sentToday: number = 0
  private sentThisHour: number = 0
  private lastResetTime: number = Date.now()
  private hourlyResetTime: number = Date.now()
  private lastEmailTime: number = 0

  constructor(private config: RateLimitConfig) {
    this.config = config
  }

  private resetDailyIfNeeded() {
    const now = Date.now()
    const hoursSinceReset = (now - this.lastResetTime) / (1000 * 60 * 60)
    
    if (hoursSinceReset >= 24) {
      this.sentToday = 0
      this.lastResetTime = now
      console.log('🔄 Daily email counter reset')
    }
  }

  private resetHourlyIfNeeded() {
    const now = Date.now()
    const hoursSinceReset = (now - this.hourlyResetTime) / (1000 * 60 * 60)
    
    if (hoursSinceReset >= 1) {
      this.sentThisHour = 0
      this.hourlyResetTime = now
      console.log('🔄 Hourly email counter reset')
    }
  }

  async checkCanSend(): Promise<{ canSend: boolean; reason?: string; waitTime?: number }> {
    this.resetDailyIfNeeded()
    this.resetHourlyIfNeeded()

    // Check daily limit ONLY - skip hourly limit
    if (this.sentToday >= this.config.maxPerDay) {
      const hoursUntilReset = 24 - ((Date.now() - this.lastResetTime) / (1000 * 60 * 60))
      return {
        canSend: false,
        reason: `Daily limit exceeded (${this.sentToday}/${this.config.maxPerDay})`,
        waitTime: hoursUntilReset * 60 * 60 * 1000
      }
    }

    // Skip hourly limit check - only check cooldown
    // Check cooldown between emails
    const now = Date.now()
    const timeSinceLastEmail = now - this.lastEmailTime
    const cooldownTime = this.config.cooldownMinutes * 60 * 1000

    if (timeSinceLastEmail < cooldownTime) {
      return {
        canSend: false,
        reason: `Cooldown period (${this.config.cooldownMinutes} minutes)`,
        waitTime: cooldownTime - timeSinceLastEmail
      }
    }

    return { canSend: true }
  }

  async waitForSlot(): Promise<void> {
    const check = await this.checkCanSend()
    
    if (!check.canSend && check.waitTime) {
      console.log(`⏱️ Rate limit active: ${check.reason}`)
      console.log(`⏳ Waiting ${Math.round(check.waitTime / 1000)} seconds...`)
      
      await new Promise(resolve => setTimeout(resolve, check.waitTime!))
      return this.waitForSlot() // Recursive check
    }
  }

  recordSent() {
    this.sentToday++
    this.sentThisHour++
    this.lastEmailTime = Date.now()
    
    console.log(`📊 Email sent: ${this.sentThisHour}/hour, ${this.sentToday}/day`)
  }

  getStats() {
    return {
      sentToday: this.sentToday,
      sentThisHour: this.sentThisHour,
      dailyLimit: this.config.maxPerDay,
      hourlyLimit: this.config.maxPerHour,
      dailyRemaining: this.config.maxPerDay - this.sentToday,
      hourlyRemaining: this.config.maxPerHour - this.sentThisHour
    }
  }
}

// Gmail-fast configuration - HIGH VOLUME, NO HOURLY LIMIT
export const gmailRateLimiter = new RateLimiter({
  maxPerHour: 9999,    // NO HOURLY LIMIT
  maxPerDay: 350,     // Increased to 350 emails/day (safe margin from 500)
  cooldownMinutes: 0.05 // 3 seconds antar email untuk high speed
})

// For testing with higher limits
export const testRateLimiter = new RateLimiter({
  maxPerHour: 1000,
  maxPerDay: 10000,
  cooldownMinutes: 0.1 // 6 seconds between emails
})
