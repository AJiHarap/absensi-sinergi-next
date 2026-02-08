# Email Deliverability Guide - Gmail SMTP Configuration

## 🔧 Perbaikan yang Telah Dilakukan

### 1. Konfigurasi SMTP yang Ditingkatkan
- **Connection pooling** untuk mengurangi koneksi berulang
- **Rate limiting** (5 email per detik) untuk menghindari throttling
- **TLS configuration** untuk koneksi yang aman
- **Auto-reconnect** dengan connection pool

### 2. Anti-Spam Headers
Headers berikut ditambahkan untuk mengurangi kemungkinan dianggap spam:
- `X-Priority`, `X-MSMail-Priority` untuk prioritas email
- `List-Unsubscribe` untuk compliance
- `X-Auto-Response-Suppress` untuk menghindari auto-reply
- `X-Mailer` untuk identifikasi pengirim

## 📋 Langkah-Langkah Tambahan yang Diperlukan

### 1. Gunakan App Password (WAJIB)
```bash
# Jangan gunakan password Gmail biasa!
# Buat App Password di: https://myaccount.google.com/apppasswords
```

### 2. Konfigurasi SPF (Sender Policy Framework)
Tambahkan TXT record di domain Anda:
```
v=spf1 include:_spf.google.com ~all
```

### 3. Konfigurasi DKIM (DomainKeys Identified Mail)
Jika menggunakan custom domain:
1. Aktifkan DKIM di Google Workspace
2. Tambahkan CNAME record yang diberikan Google

### 4. Konfigurasi DMARC
Tambahkan TXT record:
```
_dmarc.yourdomain.com. IN TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com"
```

## 🚨 Best Practices

### 1. Content Guidelines
- Hindari kata-kata spam trigger: "FREE", "WINNER", "URGENT", "!!!"
- Gunakan text version untuk setiap HTML email
- Hindari link yang mencurigakan
- Gun unsubscribe link yang jelas

### 2. Sending Patterns
- Jangan kirim email dalam batch besar secara tiba-tiba
- Gunakan warm-up period untuk alamat baru
- Monitor bounce rate dan unsubscribe rate

### 3. Monitoring
- Gunakan Google Postmaster Tools
- Monitor deliverability rate
- Track spam complaints

## 🔍 Troubleshooting

### Jika Masih Dianggap Spam:
1. **Check IP reputation**: Pastikan IP server tidak masuk blacklist
2. **Verify authentication**: Pastikan SPF/DKIM/DMARC valid
3. **Content review**: Periksa konten email untuk trigger words
4. **Volume control**: Kurangi volume pengiriman

### Error Messages:
- `535 5.7.8 Username and Password not accepted`: Gunakan App Password
- `550 5.7.1 Relaying denied`: Periksa konfigurasi SMTP
- `421 4.7.0 Too many connections`: Rate limit terlampaui

## 📞 Support

Untuk bantuan lebih lanjut:
1. Google Workspace Admin Console
2. Google Postmaster Tools
3. Gmail SMTP Documentation

## ⚠️ Important Notes

- **JANGAN** gunakan password Gmail biasa, gunakan App Password
- **VERIFIKASI** domain Anda untuk deliverability terbaik
- **MONITOR** bounce rate dan spam complaints
- **SCALE UP** pengiriman secara bertahap
