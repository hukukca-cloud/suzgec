# Süzgeç

**PDF, Word (.docx) ve UYAP Doküman Formatı (.udf) belgeleri için çevrimdışı, açık kaynak kişisel veri temizleme aracı.**

Süzgeç; dilekçe, karar, sözleşme ve benzeri belgelerde yer alan kişisel verileri tespit ederek karartır ya da tutarlı etiketlerle değiştirir. Araç tek bir HTML dosyasından ibarettir; kurulum gerektirmez, internet bağlantısı kullanmaz ve belgeleri herhangi bir sunucuya iletmez.

---

## Kullanım

1. [`dist/suzgec.html`](dist/suzgec.html) dosyasını indiriniz.
2. Dosyayı güncel bir tarayıcıda (Chrome, Edge, Firefox, Safari) çift tıklayarak açınız. İsterseniz bilgisayarınızın internet bağlantısını kesebilirsiniz; araç aynı şekilde çalışır.
3. Belgeleri sürükleyip bırakınız veya **Dosya seç** düğmesini kullanınız.
4. **Tara ve incele** düğmesiyle taramayı başlatınız. Her belge için iki görünüm sunulur:
   - **Belge görünümü:** Belge metni, temizlenecek ifadeler numaralandırılmış ve kırmızı ile işaretlenmiş hâlde gösterilir. **Özgün metin / Temizlenmiş hâli** anahtarıyla belgenin temizleme sonrasındaki görünümü önceden incelenebilir. Yan paneldeki **Değişiklikler** listesi her değişikliğin numarasını, paragraf veya sayfa konumunu ve yerine konacak ifadeyi gösterir; listedeki bir öğeye tıklandığında belgede ilgili yere gidilir.
   - **Bulgu listesi:** Bulgular kategori bazında, bağlamlarıyla birlikte listelenir.
5. Yanlış tespit edilen bir ifadeye belge görünümünde tıklayarak işaretini kaldırabilir, gözden kaçan bir ifadeyi fareyle seçip **“… ifadesini temizle”** düğmesiyle tüm belgelere ekleyebilirsiniz. Özet çubuğundaki kategori düğmeleri bir kategoriyi tüm belgelerde topluca açar veya kapatır; arama kutusu bulgular arasında filtreleme sağlar.
6. **İndirme biçimi** olarak “Özgün biçimde” ya da “Tümünü Word (.docx) olarak” seçeneğini belirleyiniz. İkinci seçenekte PDF ve UDF belgeleri de temizlenmiş metinleriyle düzenlenebilir Word dosyasına dönüştürülür; PDF'te elle karartılan alanlar da Word çıktısına yansıtılır. Dönüştürmede sayfa düzeni ve görseller aktarılmaz.
7. **Temizle ve indir** düğmesiyle temizlenmiş belgeleri indiriniz. Birden çok dosya üretildiğinde çıktılar tek bir ZIP arşivi olarak verilir.

Özel ve hariç listeler **Listeleri kaydet** düğmesiyle bilgisayarınıza `.json` dosyası olarak kaydedilebilir ve sonraki kullanımlarda **Listeleri yükle** ile geri alınabilir. Araç, tercihleri tarayıcıda saklamaz.

İndirilen dosyanın bütünlüğü, depodaki `dist/suzgec.html.sha256` değeriyle karşılaştırılarak doğrulanabilir.

## Tespit edilen veri türleri

| Kategori | Kapsam |
|---|---|
| T.C. Kimlik No | 11 haneli, resmî algoritmayla doğrulanmış numaralar |
| Vergi Kimlik No | 10 haneli, algoritmayla doğrulanmış ve "vergi"/"VKN" bağlamında geçen numaralar |
| IBAN | TR ve yabancı IBAN'lar (mod-97 doğrulamalı, boşluklu yazım dahil) |
| Telefon | Sabit ve mobil hatlar; +90, 0 önekli ve parantezli yazımlar |
| E-posta | Standart e-posta adresleri |
| Araç plakası | İl kodu, harf ve rakam düzenine uygun plakalar (HD, CGK gibi künye kısaltmaları hariç) |
| Doğum tarihi | "Doğum tarihi", "D.T.", "… doğumlu" bağlamındaki tarihler |
| Adres | Mahalle, cadde, sokak, bulvar, site, apartman, kapı/daire/kat numarası, ilçe/il ve posta kodu dizileri |
| Dosya numarası | Esas, karar, soruşturma, talimat ve icra dosya numaraları. Yargıtay, Danıştay, BAM gibi emsal künyeleri ayrıca işaretlenir ve **varsayılan olarak seçilmez** |
| Kişi adı | Türkçe ad sözlüğü ve "davacı", "sanık", "tanık", "vekili Av.", "Adı Soyadı", "baba adı" gibi bağlam kalıpları; tespit edilen adın ve soyadının belgedeki diğer geçişleri |
| Özel liste | Kullanıcının tanımladığı ifadeler |

Kurum, şirket ve üniversite adları (ör. "… Ticaret A.Ş.", "… Üniversitesi") kişi adı olarak işaretlenmez. Tüzel kişilere ait bilgiler 6698 sayılı Kanun kapsamında kişisel veri niteliği taşımadığından araç bunları kural olarak dışarıda bırakır; gerekli görülmesi hâlinde **Özel liste** üzerinden eklenebilir.

## Temizleme biçimleri

- **Karartma:** Word ve UDF belgelerinde ifadeler `█████` ile, PDF belgelerinde siyah bant ile değiştirilir. Maske uzunluğu sabittir; böylece gizlenen ifadenin uzunluğu da açığa çıkmaz.
- **Tutarlı etiketleme:** İfadeler `[KİŞİ-1]`, `[TCKN-1]`, `[ADRES-2]` gibi etiketlerle değiştirilir. Aynı anda işlenen tüm belgelerde aynı kişi aynı etiketi alır; bu sayede belgeler arasındaki bağlantı okunabilir kalır. İsteğe bağlı olarak etiket–özgün ifade eşleme tablosu indirilebilir (bkz. aşağıdaki hukuki değerlendirme).

## Değişiklik takibi

- **Çıktıda işaretleme (varsayılan olarak açık):** Word çıktısında değiştirilen her ifade kırmızı zemin ve çerçeveyle, UDF çıktısında kırmızı ve kalın yazıyla işaretlenir. Belge açıldığında neyin değiştirildiği doğrudan görülebilir. Word'ün “izlenen değişiklikler” özelliği bilinçli olarak kullanılmamaktadır; zira bu yöntem silinen kişisel veriyi dosyanın içinde saklamaya devam eder.
- **Belge görünümü:** Uygulama içinde her değişiklik numaralandırılarak gösterilir; yan paneldeki listede özgün ifade ile yerine konan ifade, paragraf veya sayfa konumuyla birlikte yer alır.

## Biçime özgü işlemler

**Word (.docx)**
- Gövde, üst ve alt bilgiler, dipnotlar, son notlar ve yorumlar taranır; izlenen değişikliklerdeki silinmiş metin de kapsama dahildir.
- Biçimlendirme nedeniyle birden çok parçaya bölünmüş ifadeler (ör. kısmen kalın yazılmış ad) bütün hâlinde tespit edilir.
- Yazar, son değiştiren, şirket ve yönetici bilgileri; yorum ve değişiklik yazarları; `people.xml` kayıtları ile ilk sayfanın küçük resmi temizlenir.
- E-posta (`mailto:`) ve telefon (`tel:`) bağlantıları ile kişisel veri içeren dış bağlantı adresleri etkisiz hâle getirilir.

**UDF**
- UDF bir ZIP arşivi olup metin, `content.xml` dosyasındaki tek bir bölümde; biçimlendirme ise bu metne başlangıç ofseti ve uzunlukla atıf yapan öğelerde tutulur. Etiketleme metin uzunluğunu değiştirdiğinden, tüm ofsetler yeniden hesaplanır ve belge yapısı korunur.

**PDF**
- Her sayfa görüntüye dönüştürülür ve karartma bu görüntü üzerine uygulanır. Bu yöntem, karartılan metnin bant altında seçilebilir biçimde kalması riskini ortadan kaldırır; özgün metin katmanı, gizli metinler, yorumlar, form alanları, ekler ve üst veriler çıktıya taşınmaz.
- Çıktıda metin seçimi ve arama yapılamaz; çözünürlük 150, 200 veya 300 dpi olarak seçilebilir.
- **Sayfa önizlemesi ve elle karartma** ekranında, otomatik olarak tespit edilemeyen alanlar (imza, kaşe, el yazısı, taranmış sayfalar) fareyle işaretlenerek karartılabilir.

## Gizlilik ve güvenlik mimarisi

- **Ağ erişimi teknik olarak kapalıdır.** Sayfa, `connect-src 'none'` dahil olmak üzere her türlü dış kaynak yüklemesini ve ağ bağlantısını engelleyen bir İçerik Güvenliği Politikası (CSP) ile yüklenir. Bu politika tarayıcı tarafından uygulanır; uygulama kodu istese dahi veri gönderemez.
- **Dış bağımlılık yüklenmez.** Kullanılan kütüphaneler (pdf.js, JSZip) derleme sırasında HTML dosyasının içine gömülür.
- **Kalıcı kayıt tutulmaz.** Belgeler yalnızca açık sekmenin belleğinde işlenir; tarayıcı depolaması, çerez veya önbellek kullanılmaz. **Oturumu temizle** düğmesi ya da sekmenin kapatılması tüm verileri bellekten kaldırır.
- **Denetlenebilirlik.** Kaynak kod okunabilir biçimde `src/` klasöründedir. Derleme betiği, uygulama kodunda ağ çağrısı yapabilecek ifadeler bulunması hâlinde derlemeyi durdurur.

Tarayıcı geliştirici araçlarının "Ağ" (Network) sekmesi açılarak, araç kullanılırken hiçbir dış istekte bulunulmadığı bizzat gözlemlenebilir.

## Hukuki değerlendirme

Süzgeç'in mimarisi, aracın geliştiricisine veya herhangi bir üçüncü kişiye belgelerdeki kişisel verilere erişim imkânı tanımamaktadır. Bu itibarla geliştirici bakımından, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) anlamında bir veri işleme faaliyetinin ya da veri aktarımının söz konusu olmadığı değerlendirilmektedir.

Bununla birlikte, kullanıcının kendi cihazında gerçekleştirdiği maskeleme işleminin, KVKK m. 3/1-e'de yer alan geniş "işleme" tanımı karşısında kullanıcı bakımından bir işleme faaliyeti niteliği taşıyabileceği gözden kaçırılmamalıdır. Bu çerçevede aşağıdaki hususların dikkate alınması önerilir:

- **Karartma** yönteminde, ifadeler geri döndürülemez biçimde kaldırılır. Ancak belgede kalan bağlamsal bilgiler (unvan, görev, olay örgüsü, tarih ve yer bilgisi) ilgili kişinin dolaylı olarak belirlenebilmesine imkân verebilir. Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik uyarınca anonim hâle getirmeden söz edilebilmesi için verinin başka verilerle eşleştirilerek dahi kimliği belirli veya belirlenebilir bir kişiyle ilişkilendirilememesi gerektiğinden, çıktının bu yönüyle de değerlendirilmesi uygun olacaktır.
- **Etiketleme** yönteminde ve özellikle **eşleme tablosunun** saklanması hâlinde elde edilen sonucun, anonim hâle getirme değil takma adlandırma (psödonimleştirme) niteliğinde olduğu kabul edilmelidir. Eşleme tablosu kişisel veri içermekte olup temizlenmiş belgelerle birlikte paylaşılmamalı ve uygun güvenlik tedbirleriyle korunmalıdır.
- Otomatik tespit, kişisel verilerin tamamının yakalanacağını **güvence altına almaz**. Özellikle sözlükte yer almayan adlar, olağandışı adres yazımları, görseller ve taranmış belgeler bakımından çıktının paylaşılmadan önce kullanıcı tarafından kontrol edilmesi gerekmektedir.

Bu bölüm genel bilgilendirme amacı taşımakta olup somut olaylara ilişkin hukuki görüş niteliğinde değildir.

## Bilinen sınırlar

- Görseller (taranmış kimlik, imza, kaşe) içindeki veriler otomatik olarak tespit edilmez; PDF'lerde elle karartma kullanılabilir, Word ve UDF belgelerinde ise görseller elle kontrol edilmelidir.
- Taranmış (metin katmanı bulunmayan) PDF'lerde otomatik tespit yapılamaz; optik karakter tanıma (OCR) kapsam dışındadır.
- Parola korumalı PDF'ler ve eski Word biçimi (.doc) desteklenmemektedir.
- E-imzalı UDF ve Word belgelerinde, temizleme sonrasında imza geçerliliğini yitirir.
- Kişi adı tespiti sözlük ve bağlam kalıplarına dayanır; yanlış pozitif ve yanlış negatif sonuçlar oluşabilir.

## İmza

Sayfadaki IsThisLegal imzası derleme sırasında `assets/imza.json` dosyasından üretilir ve [@isthis_legal](https://x.com/isthis_legal) hesabına bağlantı verir. Bağlantı yalnızca kullanıcı tıkladığında yeni sekmede açılır; araç kendiliğinden herhangi bir ağ isteğinde bulunmaz. `assets/logo.png` (veya `.jpg`, `.webp`) dosyası eklenirse hesap logosu olarak sayfaya gömülür; aksi hâlde yerleşik terazi simgesi kullanılır.

## Geliştirme

```bash
npm install          # pdf.js ve JSZip yerel olarak indirilir
npm test             # tespit motoru testleri
npm run build        # dist/suzgec.html ve SHA-256 özetini üretir
```

`main` dalına yapılan her gönderimde GitHub Actions (`.github/workflows/derle.yml`) testleri çalıştırır, `dist/suzgec.html` dosyasını yeniden derler ve depoya yazar.

Uçtan uca tarayıcı testi için (Python ve Playwright gerektirir):

```bash
python3 test/ornek-uret.py   # sentetik örnek belgeler (tüm kişi ve numaralar uydurmadır)
python3 test/e2e.py          # Chrome'da örnekleri işler; ağ isteği ve konsol hatası olmadığını doğrular
```

### Proje yapısı

```
src/
  adlar.js           Türkçe ad sözlüğü
  core.js            Tespit motoru, doğrulama algoritmaları, etiketleme
  metin-haritasi.js  Parçalı XML metnini tek metin olarak tarama ve geri yazma
  docx.js            Word işleyici
  udf.js             UDF işleyici
  pdf.js             PDF işleyici ve görüntü tabanlı PDF yazıcısı
  ui.js              Arayüz
  sablon.html        Sayfa şablonu ve güvenlik politikası
build.js             Tek dosya derleme betiği
test/                Birim ve uçtan uca testler, sentetik örnekler
```

## Katkı

Ad sözlüğünün genişletilmesi, yeni bağlam kalıpları, yanlış pozitif örnekleri ve UDF biçimine ilişkin gözlemler için katkılarınızı bekleriz. Hata bildirimlerinde **gerçek kişisel veri içeren belge paylaşılmamalı**, sorun uydurma verilerle yeniden üretilmelidir.

## Lisans

Süzgeç [MIT Lisansı](LICENSE) ile yayımlanmaktadır. Gömülü üçüncü taraf kütüphanelerin lisansları için [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) dosyasına bakınız.
