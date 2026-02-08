// Test script untuk FAST bulk email dengan high performance
require('dotenv').config({ path: '.env.local' });

const { sendFastBulkEmail, estimateSendTime } = require('./src/lib/fast-bulk-mailer.ts');

async function testFastBulkEmail() {
  try {
    const emailCount = 320; // Test 320 emails
    const testEmail = process.env.GMAIL_USER;
    
    // Create test email list (duplicate untuk simulasi)
    const testEmails = Array(emailCount).fill(testEmail);
    
    console.log(`🧪 Testing FAST bulk email to ${emailCount} recipients...`);
    
    // Estimate waktu
    const estimate = estimateSendTime(emailCount, 5);
    console.log(`📊 Estimated time: ${estimate.estimatedMinutes.toFixed(1)} minutes`);
    console.log(`🚀 Expected speed: ${estimate.emailsPerSecond.toFixed(1)} emails/second`);
    
    // Test parameters
    const bulkParams = {
      recipients: testEmails,
      subject: '🚀 FAST Bulk Email Test - High Performance',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">🚀 FAST Bulk Email Performance Test</h2>
          <p>Ini adalah test FAST bulk email dengan konfigurasi high performance.</p>
          
          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>⚡ High Performance Settings:</h3>
            <ul>
              <li>✅ <strong>Concurrency:</strong> 5 emails simultaneously</li>
              <li>✅ <strong>Cooldown:</strong> 3 seconds antar batch</li>
              <li>✅ <strong>Daily Limit:</strong> 350 emails/day</li>
              <li>✅ <strong>No Hourly Limit:</strong> Unlimited per hour</li>
              <li>✅ <strong>Parallel Processing:</strong> 5 concurrent connections</li>
            </ul>
          </div>
          
          <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>📈 Performance Metrics:</h3>
            <ul>
              <li>📧 <strong>Target:</strong> ${emailCount} emails</li>
              <li>⏱️ <strong>Estimate:</strong> ${estimate.estimatedMinutes.toFixed(1)} minutes</li>
              <li>🚀 <strong>Speed:</strong> ${estimate.emailsPerSecond.toFixed(1)} emails/second</li>
              <li>⚡ <strong>Concurrency:</strong> 5 parallel</li>
            </ul>
          </div>
          
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>⚠️ Gmail Safety:</h3>
            <ul>
              <li>📊 <strong>Daily Limit:</strong> 350/500 emails (safe margin)</li>
              <li>🛡️ <strong>Anti-Spam:</strong> 3 second cooldown</li>
              <li>🔄 <strong>Auto-Pause:</strong> If limit reached</li>
            </ul>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            Test waktu: ${new Date().toLocaleString('id-ID')}<br>
            Email #${Math.floor(Math.random() * 1000) + 1}
          </p>
        </div>
      `,
      concurrency: 5 // 5 emails bersamaan
    };

    console.log('🚀 Mengirim FAST bulk email...');
    const startTime = Date.now();
    
    const results = await sendFastBulkEmail(bulkParams);
    
    const totalTime = Date.now() - startTime;
    const avgTimePerEmail = totalTime / results.total;
    const emailsPerSecond = results.success.length / (totalTime / 1000);

    console.log('\n🎉 FAST Bulk Email Test Results:');
    console.log(`📊 Total emails: ${results.total}`);
    console.log(`✅ Success: ${results.success.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    console.log(`⏱️ Total time: ${(totalTime / 1000).toFixed(2)} seconds`);
    console.log(`🚀 Average per email: ${avgTimePerEmail.toFixed(0)}ms`);
    console.log(`⚡ Actual speed: ${emailsPerSecond.toFixed(1)} emails/second`);
    console.log(`📈 Success rate: ${((results.success.length / results.total) * 100).toFixed(1)}%`);

    return results.success.length > 0;
  } catch (error) {
    console.error('❌ Error in FAST bulk email test:', error.message);
    return false;
  }
}

// Run test
testFastBulkEmail().then(success => {
  if (success) {
    console.log('\n🎉 FAST bulk email test selesai! High performance achieved.');
  } else {
    console.log('\n⚠️ FAST bulk email test gagal. Periksa konfigurasi.');
  }
  process.exit(success ? 0 : 1);
});
