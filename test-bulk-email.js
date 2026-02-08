// Test script untuk bulk email dengan performance optimization
require('dotenv').config({ path: '.env.local' });

const { sendBulkEmail, validateEmailList } = require('./src/lib/bulk-mailer.ts');

async function testBulkEmail() {
  try {
    // Test dengan banyak email (gunakan email test yang sama untuk demo)
    const testEmails = [
      process.env.GMAIL_USER, // Email utama
      // Tambahkan email test lainnya jika ada
      // 'test1@example.com',
      // 'test2@example.com',
      // ... dst
    ];

    // Jika hanya ada 1 email, buat beberapa duplikat untuk simulasi
    const emails = testEmails.length === 1 
      ? Array(50).fill(testEmails[0]) // Simulasi 50 email
      : testEmails;

    console.log(`🧪 Testing bulk email to ${emails.length} recipients...`);

    // Validasi email list
    const { valid, invalid } = validateEmailList(emails);
    if (invalid.length > 0) {
      console.log(`⚠️ Skipping ${invalid.length} invalid emails`);
    }

    if (valid.length === 0) {
      console.log('❌ No valid emails to test');
      return;
    }

    // Test parameters
    const bulkParams = {
      recipients: valid,
      subject: '📊 Bulk Email Test - Performance Optimization',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">🚀 Bulk Email Performance Test</h2>
          <p>Ini adalah test bulk email dengan konfigurasi yang dioptimasi untuk kecepatan.</p>
          
          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>⚡ Performance Optimizations:</h3>
            <ul>
              <li>✅ <strong>Max Connections:</strong> 10 (dari 5)</li>
              <li>✅ <strong>Rate Limit:</strong> 10 emails/detik (dari 5)</li>
              <li>✅ <strong>Batch Processing:</strong> 20 email/batch</li>
              <li>✅ <strong>Parallel Processing:</strong> Dalam batch</li>
              <li>✅ <strong>Smart Delay:</strong> 1 detik antar batch</li>
            </ul>
          </div>
          
          <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>📈 Expected Performance:</h3>
            <ul>
              <li>📧 <strong>100 emails:</strong> ~10-15 detik</li>
              <li>📧 <strong>500 emails:</strong> ~50-60 detik</li>
              <li>📧 <strong>1000 emails:</strong> ~100-120 detik</li>
            </ul>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            Test waktu: ${new Date().toLocaleString('id-ID')}<br>
            Batch #${Math.floor(Math.random() * 100) + 1}
          </p>
        </div>
      `,
      batchSize: 20, // 20 email per batch
      delayBetweenBatches: 1000 // 1 detik antar batch
    };

    console.log('📤 Mengirim bulk email...');
    const startTime = Date.now();
    
    const results = await sendBulkEmail(bulkParams);
    
    const totalTime = Date.now() - startTime;
    const avgTimePerEmail = totalTime / results.total;

    console.log('\n🎉 Bulk Email Test Results:');
    console.log(`📊 Total emails: ${results.total}`);
    console.log(`✅ Success: ${results.success.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    console.log(`⏱️ Total time: ${(totalTime / 1000).toFixed(2)} seconds`);
    console.log(`🚀 Average per email: ${avgTimePerEmail.toFixed(0)}ms`);
    console.log(`📈 Success rate: ${((results.success.length / results.total) * 100).toFixed(1)}%`);

    return results.success.length > 0;
  } catch (error) {
    console.error('❌ Error in bulk email test:', error.message);
    return false;
  }
}

// Run test
testBulkEmail().then(success => {
  if (success) {
    console.log('\n🎉 Bulk email test selesai! Performancesudah dioptimasi.');
  } else {
    console.log('\n⚠️ Bulk email test gagal. Periksa konfigurasi.');
  }
  process.exit(success ? 0 : 1);
});
