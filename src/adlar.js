/*
 * Süzgeç — Türkçe kişi adı sözlüğü
 * Yaygın Türkçe ad listesi. Liste, yalnızca metin içindeki olası kişi adlarını
 * işaretlemek için kullanılır; herhangi bir gerçek kişiye ait veri içermez.
 * Katkı: Yeni adlar küçük harfle ve Türkçe karakterlerle eklenmelidir.
 */
(function (root) {
  'use strict';
  var ADLAR = (
    'abdullah abdulkadir abdurrahman abdülkadir abdülhamit adem adil adnan affan afet agah ahmet akın akif alaattin alev ali alim alp alparslan alper alpay alptekin altan altay altuğ arda arif arslan arzu asaf asena asiye aslı aslıhan asım asuman atakan atilla atıf ayberk aybike ayça ayda aydan aydın ayfer aygül aygün ayhan aykut aylin ayla aynur ayperi ayse ayser aysel aysun ayşe ayşegül ayşen ayten aytaç aytekin ayşenur azize aziz ' +
    'bahadır bahar bahri baki banu baran barbaros barış başak batuhan battal bayram bedia bedirhan bedri behiye behçet bekir belgin belkıs belma bengü bengisu beren berfin berk berkant berkay berna berrak berra beste betül beyza bilal bilge bilgehan bilgin binnur birgül birol birsen bora buket bulut burak burcu burçin burçak burhan buse busem büşra bülent bünyamin büşranur ' +
    'cafer can canan candan caner cankat cansu cavit celal celil cem cemal cemil cemile cenk cengiz cennet cevat cevdet ceyda ceylan ceyhun cihan cihat coşkun cumali cüneyt çağan çağatay çağdaş çağla çağlar çağrı çelik çetin çiğdem çınar ' +
    'dalya damla davut defne demet demir demircan deniz derin derya devrim didem dilan dilara dilber dilek dilşad doğa doğan doğukan dolunay döndü dudu duygu duru dursun durmuş dündar ' +
    'ebru ece ecem ecrin eda edip efe efecan egemen ekin ekrem elçin elif elifnaz elvan emel emin emine emir emirhan emre emrah ender enes engin enis enver erdal erdem erdi erdinç erdoğan eren ergin ergün erhan erkan erkut erol ersin ertan ertuğrul esat esin esma esra eylem eylül ezgi ekber ' +
    'fadime fahri faik fatih fatma fazıl fehmi fehime ferda feride ferdi feray ferhat feridun ferit fethi fevzi feyza feyzullah fidan figen fikret filiz fuat funda furkan fusun füsun fulya ' +
    'gamze gaye gizem gökay gökçe gökhan göksel göktuğ gönül görkem gülay gülbahar gülcan gülden gülhan gülizar güler gülsüm gülşen gülten gülnur gürkan güven güzin gülistan güner güney gürsel ' +
    'habibe hacer hadi hafize hakan hakkı halil halime halit halis haluk hamdi hamit hamza hande hanife harun hasan hasret hatice hayati haydar hayri hayriye hazal hediye helin hikmet hilal hilmi hira hülya hüseyin hüsnü hümeyra ' +
    'ilayda ilhan ilker ilknur ilkay ilyas irem irfan ismail ismet işıl ıhsan ihsan inci ipek izzet iclal ' +
    'kaan kader kadir kadriye kamil kamuran kardelen kâmil kazım kemal kenan kerem kerim kevser kezban kubilay kudret kumru kutay kübra kürşat ' +
    'lale latif latife leman lerzan levent leyla lütfi lütfiye ' +
    'mahmut mahir makbule mazlum mehmet mehmetcan mehtap melda melek melih meliha melike melis meltem memduh meral merve mert mertcan mesut metin mevlüt mihriban mine miraç mithat muammer muhammed muhammet muharrem muhsin muhterem murat murathan musa mustafa muzaffer mücahit müge münevver mürsel müslüm mükerrem ' +
    'nadide nadir nail naim nalan namık nazan nazım nazlı nebahat necati necdet necla necmettin necmi nedim nedret nehir nermin nesibe nesrin neslihan neşe nevin nevzat neval nezahat nezih nihal nihat nilay nilgün nilüfer nimet nisa nur nuran nurcan nurettin nurhan nuri nurten nurşen nursel nusret nükhet ' +
    'oğuz oğuzhan okan okay oktay olcay onur orhan orçun osman ozan ömer önder özcan özden özge özgür özkan özlem öykü özer özgen ' +
    'pakize pelin pembe perihan pervin pınar polat ' +
    'rabia rahmi ramazan rana rasim rauf recep refik reha remzi resul reşat reyhan rıdvan rıza rifat ruhi rukiye rüya rüstem rüştü ' +
    'saadet sabahattin sabri sacit sadık sadettin sadi safiye sahra saim salih salim saliha samet sami samed sanem sarp savaş seçil seda sedat sedef sefa selahattin selami selçuk selda selen selim selin selma sema semih semiha semra senem seray serap serdar seren serhan serhat serkan sermin serpil sertaç server servet sevda sevgi sevil sevilay sevim sevinç seyfi seyit sezai sezen sezer sezgin sibel sidar simge sinan sinem sevtap soner sonay songül suat sudenaz sude sultan suna sunay suzan süheyla süleyman sümeyye süreyya ' +
    'şafak şahin şaban şadiye şebnem şehmus şenay şengül şenol şerafettin şerife şeyma şevket şevval şeref şirin şükrü şule şükran ' +
    'taha tahir tahsin talat taner tansu tarık tayfun taylan tayyip tekin temel teoman tevfik tolga tuba tuğba tuğçe tuğrul tuna tunahan tunç turan turgay turgut tülay tülin türkan tuncay tufan ' +
    'ufuk uğur ulaş ulvi umur utku ümran ümmü ümit ünal üzeyir ' +
    'vahap vahit vedat veli vesile veysel vildan volkan vural ' +
    'yağmur yahya yakup yalçın yaman yasemin yasin yaşar yavuz yeliz yeşim yıldız yıldırım yılmaz yiğit yonca yunus yusuf yüksel zafer zahide zehra zekai zeki zekiye zerrin zeynep zübeyde zühal zülfikar zümrüt ziya'
  ).split(/\s+/);

  /* Sözlükte yer almakla birlikte günlük dilde sıkça cins isim olarak geçen adlar.
     Bu adlar yalnızca bağlam (davacı, sanık vb.) bulunduğunda kişi adı sayılır. */
  var BELIRSIZ = ('ay can deniz barış bahar derya umut ümit kader nur hilal yıldız demir çelik polat ' +
    'temel güven doğan bulut nehir doğa yağmur yaman arslan erdem yılmaz özer duru defne ' +
    'gaye zafer devrim tuna kumru sevinç sevgi şafak servet hikmet nimet yonca ' +
    'ipek inci reyhan filiz güler gönül hayati melek emir kamil sabri saadet fidan pembe sultan selim sami adil aziz vural ufuk').split(/\s+/);

  var api = { ADLAR: ADLAR, BELIRSIZ: BELIRSIZ };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Suzgec = root.Suzgec || {}; root.Suzgec.adlar = api; }
})(typeof self !== 'undefined' ? self : this);
