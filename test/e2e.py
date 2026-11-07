# Uçtan uca tarayıcı testi: python3 test/e2e.py <cikti_klasoru>
# dist/suzgec.html dosyasını gerçek Chrome'da açar, örnek belgeleri işler, ağ isteği yapılmadığını doğrular.
import sys, os, json, zipfile
from playwright.sync_api import sync_playwright

kok = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html = 'file://' + os.path.join(kok, 'dist', 'suzgec.html')
ornek = os.path.join(kok, 'test', 'ornekler')
cikti = sys.argv[1] if len(sys.argv) > 1 else os.path.join(kok, 'test', 'cikti')
os.makedirs(cikti, exist_ok=True)

istekler, hatalar = [], []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(accept_downloads=True, viewport={'width': 1300, 'height': 900})
    sayfa = ctx.new_page()
    sayfa.on('request', lambda r: istekler.append(r.url) if not r.url.startswith(('file:', 'data:', 'blob:')) else None)
    sayfa.on('console', lambda m: hatalar.append(m.text) if m.type in ('error',) else None)
    sayfa.on('pageerror', lambda e: hatalar.append('PAGEERROR ' + str(e)))
    sayfa.goto(html)
    sayfa.set_input_files('#dosya-sec', [os.path.join(ornek, f) for f in ('ornek.docx', 'ornek.udf', 'ornek.pdf')])
    sayfa.wait_for_selector('.kart')
    sayfa.click('#tara')
    sayfa.wait_for_selector('#durum.basari', timeout=60000)
    print('DURUM:', sayfa.inner_text('#durum'))
    ozet = sayfa.evaluate("""() => Suzgec.ui.durum.dosyalar.map(d => ({ad: d.ad, hata: d.hata, n: d.bulgular.length,
        kisiler: d.bulgular.filter(b=>b.kat==='KISI').map(b=>b.text + ' ' + b.etiket),
        diger: d.bulgular.filter(b=>b.kat!=='KISI').map(b=>b.kat+':'+b.text+(b.secili?'':' (seçilmedi)'))}))""")
    for o in ozet: print(json.dumps(o, ensure_ascii=False))
    sayfa.screenshot(path=os.path.join(cikti, 'ekran-tarama.png'), full_page=False)
    ilk = sayfa.locator('.kart').first
    # Belge görünümünde bir işarete tıklayınca seçim kalkmalı, yeniden tıklayınca geri gelmeli
    once = ilk.locator('.kart-ad span').inner_text()
    ilk.locator('.belge mark[data-i]').first.click()
    sonra = ilk.locator('.kart-ad span').inner_text()
    assert once != sonra, (once, sonra)
    ilk.locator('.belge mark.birak').first.click()
    assert ilk.locator('.kart-ad span').inner_text() == once
    ilk.locator('.deg-listesi li button').nth(3).click()
    sayfa.screenshot(path=os.path.join(cikti, 'ekran-belge.png'), full_page=False, clip={'x': 0, 'y': 0, 'width': 1300, 'height': 1100})
    ilk.locator('.anahtar button', has_text='Temizlenmiş').click()
    ilk.screenshot(path=os.path.join(cikti, 'ekran-temiz.png'))
    ilk.locator('.sekme', has_text='Bulgu listesi').click()
    ilk.locator('details.grup summary .grup-ad').first.click()
    ilk.screenshot(path=os.path.join(cikti, 'ekran-liste.png'))

    for mod in ('etiket', 'karart'):
        sayfa.check(f'input[name="mod"][value="{mod}"]')
        if mod == 'etiket': sayfa.check('#esleme')
        with sayfa.expect_download(timeout=120000) as dl:
            sayfa.click('#indir')
        hedef = os.path.join(cikti, f'{mod}.zip')
        dl.value.save_as(hedef)
        with zipfile.ZipFile(hedef) as z:
            z.extractall(os.path.join(cikti, mod))
            print(mod, '->', z.namelist())
    # PDF önizleme: başlık satırını elle karart
    sayfa.click('text=Sayfa önizlemesi ve elle karartma')
    sayfa.wait_for_selector('#onizleme-govde canvas.ust')
    sayfa.wait_for_timeout(800)
    tuval = sayfa.locator('#onizleme-govde canvas.ust').first
    kutu = tuval.bounding_box()
    # Başlık (İSTANBUL ANADOLU ...) sayfanın üst kısmındadır; geniş bir şerit çiz
    y = kutu['y'] + kutu['height'] * 0.0906
    sayfa.mouse.move(kutu['x'] + kutu['width'] * 0.1, y - 8); sayfa.mouse.down()
    sayfa.mouse.move(kutu['x'] + kutu['width'] * 0.9, y + 8, steps=5); sayfa.mouse.up()
    sayfa.screenshot(path=os.path.join(cikti, 'ekran-onizleme.png'))
    sayfa.click('#onizleme-kapat')
    # Tümünü Word olarak indir
    sayfa.check('input[name="bicim"][value="docx"]')
    sayfa.uncheck('#esleme')
    with sayfa.expect_download(timeout=120000) as dl:
        sayfa.click('#indir')
    hedef = os.path.join(cikti, 'word.zip')
    dl.value.save_as(hedef)
    with zipfile.ZipFile(hedef) as z:
        z.extractall(os.path.join(cikti, 'word'))
        print('word ->', z.namelist())
    b.close()

print('AĞ İSTEKLERİ:', istekler or 'yok')
print('KONSOL HATALARI:', hatalar or 'yok')
