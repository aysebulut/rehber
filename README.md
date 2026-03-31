Gümüş Rehber (Silver Guide)
Problem
Günümüz dijital dünyası, "bilgi obezitesi" ve karmaşık bir dil bariyeri ile kuşatılmış durumdadır. Sadece yaşlı bireyler değil; Türkçeyi yeni öğrenenler, okuma güçlüğü çekenler veya yoğun stres altında hızlıca aksiyon alması gereken (hastanede, bankada, acil durumlarda) "zaman yoksulu" bireyler, teknik ve hukuki terminoloji içinde boğulmaktadır. Bu durum, bireylerin dijital hizmetlerden mahrum kalmasına neden olan evrensel bir erişilebilirlik sorunudur.

Çözüm
Gümüş Rehber; bilişsel yükü minimize eden, minimalist ve dikkat dağıtmayan bir arayüz ile bu krize çözüm sunar. Google AI Studio (Gemini 3 Flash) desteğiyle, karmaşık metinleri anlık olarak evrensel bir sadeliğe indirger. Tamamen web tabanlı yapısı sayesinde hiçbir kurulum gerektirmez; tek bir tıkla her cihazdan erişilebilir. Yüksek kontrastlı tasarımı ve sesli okuma desteğiyle bilgiyi en saf haliyle sunan bir dijital tercümandır.

Canlı Demo
Yayın Linki (Kurulum Gerektirmez): https://gumus-rehber-6a0d1c.netlify.app/

Demo Video: https://www.loom.com/share/6489ad94f8b645b0801045e1ee68963f

Kullanılan Teknolojiler
Google AI Studio & Gemini 3 Flash: Karmaşık dili evrensel sadeliğe dönüştüren ana zeka.

Node.js & React: Hızlı ve güvenilir uygulama mimarisi.

Cursor: AI destekli çevik kod geliştirme süreci.

Netlify: Uygulamanın bir web sitesi olarak her yerden erişilmesini sağlayan bulut hosting.

Tailwind CSS: "Sıfır dikkat dağınıklığı" hedefleyen, minimalist arayüz tasarımı.

Nasıl Kullanılır?
Uygulama bulut tabanlı olduğu için bilgisayarınıza bir şey indirmenize gerek yoktur:

Yayın Linkine tıklayarak siteyi açın.

Google AI Studio'dan aldığınız API anahtarını girin.

Karmaşık metni yapıştırıp "Anlat" butonuna basın.

(Geliştiriciler için yerel kurulum adımları: npm install && npm run dev)
aşağıda gelişirme sürecim hakkında mimik bir günce bulabilirsiniz 
-----GELİŞTİRME SÜRECİ-------
promtlarımı düzenlerken gemini kullandım, sonrasında iterasyonlarla son haline getirdim:

<img width="1777" height="687" alt="Ekran görüntüsü 2026-03-30 182621" src="https://github.com/user-attachments/assets/2da38bc9-987e-41f7-9b54-29f044603323" />
<img width="1762" height="734" alt="Ekran görüntüsü 2026-03-30 182516" src="https://github.com/user-attachments/assets/f48cba91-53ff-4d34-bce4-022b6b420398" />
yaşadığım bazı problemler :
Eksik/Kesik Çıktı: API yanıtları bazen kutuda yarım kalıyordu; promptu 3-6 madde ile sınırlayarak ve model çıktısını optimize ederek akışı düzelttim.

Versiyon & Kütüphane Çakışması: Gemini 1.5/3 Flash geçişinde yaşanan paket uyumsuzluklarını package.json dosyasını manuel temizleyerek çözdüm.

Format & Değişken Hataları: Ekranda sadece ":" görünmesi ve OUTPUT_FORMAT_INSTRUCTION silinmesi gibi hataları, Cursor ile kodda normalizeAndFormatSteps fonksiyonunu yazarak giderdim.
Sadeşletirme sırasında konuşma dili: bazenleri kısıtlayıcı hitaplar veya gereksiz kelime yığınları vardı , sadeleştirerek bunlardan kurtuldum.

 -----> biraz bozuk ama çalışan ilk versiyon :
<img width="1089" height="904" alt="Ekran görüntüsü 2026-03-31 133530" src="https://github.com/user-attachments/assets/aad4871a-ad8f-490e-aa8a-982f55a0fd03" />

gemini ile pcnin notebook uygulamasından kodları manuel olarak düzeltmeye çalıştım , bu kısım biraz daha zordu , boşluk noktalama kopyalama vs. hatalar cursorun yazdığ kodu kırılgan hale getirebilirdi(ve bazen de getirdi!) 
<img width="971" height="639" alt="Ekran görüntüsü 2026-03-31 142956" src="https://github.com/user-attachments/assets/850fc4ae-8611-41bf-b3c6-9c11a86f1a47" />

bazen errorlar çıktı bazense problemleri kendimce saptayıp çalıştım :
<img width="1401" height="765" alt="Ekran görüntüsü 2026-03-30 211005" src="https://github.com/user-attachments/assets/1ca100c1-5b73-4786-968c-bc682287b8ea" />

<img width="1682" height="853" alt="Ekran görüntüsü 2026-03-31 212708" src="https://github.com/user-attachments/assets/0543c1aa-1dd4-4dd6-ad5b-9ca1a5ee2d3f" />
hatalarla dolu  bir süreçten sonra üç temel özelliği basit ölçekte yerine getirebilen bir "rehberim" oldu:
gemini kullanarak metni okuyup basitleştiren
bunu output olarak metin kutusunda gösteren
sesli okuma yapalilen ,
silver guide demo .




