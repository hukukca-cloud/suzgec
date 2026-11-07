# Test için sentetik örnek belgeler üretir. Belgelerdeki tüm kişi ve numaralar uydurmadır.
import sys, zipfile, os
from docx import Document
from docx.shared import Pt
d = os.path.join(os.path.dirname(__file__), 'ornekler')
metin = open(os.path.join(d, 'dilekce.txt'), encoding='utf-8').read()

# --- DOCX: run'lara bölünmüş ad, üst/alt bilgi, yorum, yazar bilgisi ---
doc = Document()
doc.core_properties.author = 'Ayşe Nur Karakaya'
doc.core_properties.last_modified_by = 'Kerem Aksoy'
sec = doc.sections[0]
sec.header.paragraphs[0].text = 'Av. Kerem Aksoy Hukuk Bürosu – kerem.aksoy@avukat.org.tr'
sec.footer.paragraphs[0].text = 'Tel: 0216 555 44 33'
for satir in metin.split('\n'):
    p = doc.add_paragraph()
    if satir.startswith('DAVACI'):
        # Adı üç ayrı run'a böl (biri kalın)
        p.add_run('DAVACI : AYŞE ')
        r = p.add_run('NUR KARA'); r.bold = True
        p.add_run('KAYA (T.C. Kimlik No: 1000000')
        p.add_run('0146)')
    else:
        p.add_run(satir)
try:
    para = doc.paragraphs[5]
    doc.add_comment(para.runs[0], text='Mehmet Demir ile görüşülecek, 0555 111 22 33', author='Zeynep Arslan', initials='ZA')
except Exception as e:
    print('yorum eklenemedi:', e)
doc.save(os.path.join(d, 'ornek.docx'))

# --- UDF: content.xml içinde CDATA ve ofsetli öğeler ---
satirlar = metin.split('\n')
icerik = '\n'.join(satirlar)
paragraflar = []
pos = 0
for i, s in enumerate(satirlar):
    L = len(s) + 1  # satır sonu dahil
    if s.startswith('DAVACI'):
        a = len('DAVACI : ')
        paragraflar.append(f'<paragraph><content bold="true" startOffset="{pos}" length="{a}" /><content startOffset="{pos+a}" length="{L-a}" /></paragraph>')
    else:
        paragraflar.append(f'<paragraph Alignment="{1 if i==0 else 0}"><content family="Times New Roman" size="12" startOffset="{pos}" length="{L}" /></paragraph>')
    pos += L
xml = ('<?xml version="1.0" encoding="UTF-8" ?>\n<template format_id="1.8" >\n<content><![CDATA[' + icerik + '\n]]></content>\n'
       '<properties><pageFormat mediaSizeName="1" leftMargin="70.875" rightMargin="70.875" topMargin="56.7" bottomMargin="56.7" paperOrientation="1" headerFOffset="20.0" footerFOffset="20.0" /></properties>\n'
       '<elements resolver="hvl-default" >\n' + '\n'.join(paragraflar) + '\n</elements>\n'
       '<styles><style name="default" description="Geçerli" family="Dialog" size="12" bold="false" italic="false" /><style name="hvl-default" family="Times New Roman" size="12" description="Gövde" /></styles>\n</template>\n')
with zipfile.ZipFile(os.path.join(d, 'ornek.udf'), 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('content.xml', xml)
print('tamam')
