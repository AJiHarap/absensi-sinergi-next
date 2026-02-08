// Test script untuk Gmail SMTP configuration
require('dotenv').config({ path: '.env.local' });

const { sendEmail } = require('./src/lib/mailer.ts');

async function testEmail() {
  try {
    console.log('🧪 Testing Gmail SMTP configuration...');
    
    // Test email parameters
    const testParams = {
      to: process.env.TEST_EMAIL || process.env.GMAIL_USER, // kirim ke diri sendiri jika TEST_EMAIL tidak ada
      subject: '🧪 Test Email - Absensi Sinergi System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">✅ Gmail SMTP Test Berhasil!</h2>
          <p>Ini adalah email test dari sistem Absensi Sinergi dengan konfigurasi Gmail SMTP yang diperbaiki.</p>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>📋 Configuration Details:</h3>
            <ul>
              <li>✅ Connection Pooling: Enabled</li>
              <li>✅ Rate Limiting: 5 emails/detik</li>
              <li>✅ Anti-Spam Headers: Added</li>
              <li>✅ TLS Configuration: Secure</li>
              <li>✅ Auto Text Generation: Enabled</li>
            </ul>
          </div>
          
          <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>🛡️ Anti-Spam Features:</h3>
            <ul>
              <li>✅ SPF Ready</li>
              <li>✅ DKIM Compatible</li>
              <li>✅ DMARC Ready</li>
              <li>✅ Unsubscribe Headers</li>
            </ul>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            Jika Anda menerima email ini, konfigurasi Gmail SMTP berhasil!<br>
            Waktu: ${new Date().toLocaleString('id-ID')}
          </p>
        </div>
      `,
      text: `Gmail SMTP Test Berhasil!

Ini adalah email test dari sistem Absensi Sinergi dengan konfigurasi yang diperbaiki.

Configuration Details:
- Connection Pooling: Enabled
- Rate Limiting: 5 emails/detik
- Anti-Spam Headers: Added
- TLS Configuration: Secure

Anti-Spam Features:
- SPF Ready
- DKIM Compatible  
- DMARC Ready
- Unsubscribe Headers

Jika Anda menerima email ini, konfigurasi Gmail SMTP berhasil!
Waktu: ${new Date().toLocaleString('id-ID')}`
    };

    console.log('📤 Mengirim email test...');
    const result = await sendEmail(testParams);
    
    console.log('✅ Email berhasil dikirim!');
    console.log('📧 Message ID:', result.messageId);
    console.log('📊 Response:', result.response);
    
    return true;
  } catch (error) {
    console.error('❌ Error mengirim email:', error.message);
    
    if (error.code === 'EAUTH') {
      console.log('💡 Solusi: Pastikan menggunakan App Password, bukan password Gmail biasa');
      console.log('🔗 Buat App Password: https://myaccount.google.com/apppasswords');
    } else if (error.code === 'ECONNECTION') {
      console.log('💡 Solusi: Periksa koneksi internet dan konfigurasi SMTP');
    } else if (error.code === 'EMESSAGE') {
      console.log('💡 Solusi: Periksa format email dan recipient address');
    }
    
    return false;
  }
}

// Run test
testEmail().then(success => {
  if (success) {
    console.log('\n🎉 Test selesai! Gmail SMTP siap digunakan.');
  } else {
    console.log('\n⚠️ Test gagal. Periksa konfigurasi dan coba lagi.');
  }
  process.exit(success ? 0 : 1);
});
