# Gümüş Rehber (Silver Guide)

Yaşlılar için **çok basit**, **büyük puntolu**, **sarı-siyah yüksek kontrastlı** metin basitleştirici.

## Ne yapar?
- Uzun/karmaşık yönergeleri Gemini ile 3-6 kısa adıma indirger.
- Sonucu cihazın **sesli okuma** (Speech Synthesis) özelliğiyle okur.

## Kurulum
1) Bilgisayarınızda **Node.js (LTS)** kurulu olmalı. (Node kurulunca `npm` de gelir.)

2) Bu klasörde bağımlılıkları kurun:
```bash
npm install
```

3) Uygulamayı çalıştırın:
```bash
npm run dev
```

Tarayıcıda terminalin verdiği adrese gidin (genelde `http://localhost:5173`).

## Gemini API anahtarı
Uygulama açılınca ekranda **“Gemini API anahtarınızı girin”** alanı var. Anahtarınızı buraya yapıştırın.

- “Bu cihazda hatırla” açıksa anahtar tarayıcıda saklanır (localStorage).
- İsterseniz kapatıp her seferinde manuel girebilirsiniz.

