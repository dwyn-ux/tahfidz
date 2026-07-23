/* ============================================================
   Tahfidzku — Master Surat Al-Qur'an (114 Surat)
   Referensi: Mushaf Standar Indonesia (Madani)
   Setiap surat: nomor, nama latin, nama arab, jumlah ayat, halaman awal.
   ============================================================ */
const SURAHS = [
  { n: 1,  latin: "Al-Fatihah",     arab: "الفاتحة",     ayahs: 7,   page: 1 },
  { n: 2,  latin: "Al-Baqarah",     arab: "البقرة",       ayahs: 286, page: 2 },
  { n: 3,  latin: "Ali 'Imran",     arab: "آل عمران",     ayahs: 200, page: 50 },
  { n: 4,  latin: "An-Nisa",        arab: "النساء",       ayahs: 176, page: 77 },
  { n: 5,  latin: "Al-Ma'idah",     arab: "المائدة",       ayahs: 120, page: 106 },
  { n: 6,  latin: "Al-An'am",       arab: "الأنعام",       ayahs: 165, page: 128 },
  { n: 7,  latin: "Al-A'raf",       arab: "الأعراف",       ayahs: 206, page: 151 },
  { n: 8,  latin: "Al-Anfal",       arab: "الأنفال",       ayahs: 75,  page: 177 },
  { n: 9,  latin: "At-Tawbah",      arab: "التوبة",       ayahs: 129, page: 187 },
  { n: 10, latin: "Yunus",          arab: "يونس",         ayahs: 109, page: 208 },
  { n: 11, latin: "Hud",            arab: "هود",          ayahs: 123, page: 221 },
  { n: 12, latin: "Yusuf",          arab: "يوسف",         ayahs: 111, page: 235 },
  { n: 13, latin: "Ar-Ra'd",        arab: "الرعد",        ayahs: 43,  page: 249 },
  { n: 14, latin: "Ibrahim",        arab: "ابراهيم",       ayahs: 52,  page: 255 },
  { n: 15, latin: "Al-Hijr",        arab: "الحجر",        ayahs: 99,  page: 262 },
  { n: 16, latin: "An-Nahl",        arab: "النحل",        ayahs: 128, page: 267 },
  { n: 17, latin: "Al-Isra",        arab: "الإسراء",       ayahs: 111, page: 282 },
  { n: 18, latin: "Al-Kahf",        arab: "الكهف",        ayahs: 110, page: 293 },
  { n: 19, latin: "Maryam",         arab: "مريم",         ayahs: 98,  page: 305 },
  { n: 20, latin: "Ta-Ha",          arab: "طه",           ayahs: 135, page: 312 },
  { n: 21, latin: "Al-Anbiya",      arab: "الأنبياء",     ayahs: 112, page: 322 },
  { n: 22, latin: "Al-Hajj",        arab: "الحج",         ayahs: 78,  page: 332 },
  { n: 23, latin: "Al-Mu'minun",    arab: "المؤمنون",     ayahs: 118, page: 342 },
  { n: 24, latin: "An-Nur",         arab: "النور",        ayahs: 64,  page: 350 },
  { n: 25, latin: "Al-Furqan",      arab: "الفرقان",      ayahs: 77,  page: 359 },
  { n: 26, latin: "Ash-Shu'ara",    arab: "الشعراء",      ayahs: 227, page: 367 },
  { n: 27, latin: "An-Naml",        arab: "النمل",        ayahs: 93,  page: 377 },
  { n: 28, latin: "Al-Qasas",       arab: "القصص",        ayahs: 88,  page: 385 },
  { n: 29, latin: "Al-'Ankabut",    arab: "العنكبوت",     ayahs: 69,  page: 396 },
  { n: 30, latin: "Ar-Rum",         arab: "الروم",        ayahs: 60,  page: 404 },
  { n: 31, latin: "Luqman",         arab: "لقمان",        ayahs: 34,  page: 411 },
  { n: 32, latin: "As-Sajdah",      arab: "السجدة",       ayahs: 30,  page: 415 },
  { n: 33, latin: "Al-Ahzab",       arab: "الأحزاب",      ayahs: 73,  page: 418 },
  { n: 34, latin: "Saba",           arab: "سبأ",          ayahs: 54,  page: 428 },
  { n: 35, latin: "Fatir",          arab: "فاطر",         ayahs: 45,  page: 434 },
  { n: 36, latin: "Ya-Sin",         arab: "يس",           ayahs: 83,  page: 440 },
  { n: 37, latin: "As-Saffat",      arab: "الصافات",      ayahs: 182, page: 446 },
  { n: 38, latin: "Sad",            arab: "ص",            ayahs: 88,  page: 453 },
  { n: 39, latin: "Az-Zumar",       arab: "الزمر",        ayahs: 75,  page: 458 },
  { n: 40, latin: "Ghafir",         arab: "غافر",         ayahs: 85,  page: 467 },
  { n: 41, latin: "Fussilat",       arab: "فصلت",         ayahs: 54,  page: 477 },
  { n: 42, latin: "Ash-Shura",      arab: "الشورى",       ayahs: 53,  page: 483 },
  { n: 43, latin: "Az-Zukhruf",     arab: "الزخرف",       ayahs: 89,  page: 489 },
  { n: 44, latin: "Ad-Dukhan",      arab: "الدخان",       ayahs: 59,  page: 496 },
  { n: 45, latin: "Al-Jathiyah",    arab: "الجاثية",      ayahs: 37,  page: 499 },
  { n: 46, latin: "Al-Ahqaf",       arab: "الأحقاف",      ayahs: 35,  page: 502 },
  { n: 47, latin: "Muhammad",       arab: "محمد",         ayahs: 38,  page: 507 },
  { n: 48, latin: "Al-Fath",        arab: "الفتح",        ayahs: 29,  page: 511 },
  { n: 49, latin: "Al-Hujurat",     arab: "الحجرات",      ayahs: 18,  page: 515 },
  { n: 50, latin: "Qaf",            arab: "ق",            ayahs: 45,  page: 518 },
  { n: 51, latin: "Adh-Dhariyat",   arab: "الذاريات",     ayahs: 60,  page: 520 },
  { n: 52, latin: "At-Tur",         arab: "الطور",        ayahs: 49,  page: 523 },
  { n: 53, latin: "An-Najm",        arab: "النجم",        ayahs: 62,  page: 526 },
  { n: 54, latin: "Al-Qamar",       arab: "القمر",        ayahs: 55,  page: 528 },
  { n: 55, latin: "Ar-Rahman",      arab: "الرحمن",       ayahs: 78,  page: 531 },
  { n: 56, latin: "Al-Waqi'ah",     arab: "الواقعة",      ayahs: 96,  page: 534 },
  { n: 57, latin: "Al-Hadid",       arab: "الحديد",       ayahs: 29,  page: 537 },
  { n: 58, latin: "Al-Mujadila",    arab: "المجادلة",     ayahs: 22,  page: 542 },
  { n: 59, latin: "Al-Hashr",       arab: "الحشر",        ayahs: 24,  page: 545 },
  { n: 60, latin: "Al-Mumtahanah",  arab: "الممتحنة",     ayahs: 13,  page: 549 },
  { n: 61, latin: "As-Saff",        arab: "الصف",         ayahs: 14,  page: 551 },
  { n: 62, latin: "Al-Jumu'ah",     arab: "الجمعة",       ayahs: 11,  page: 553 },
  { n: 63, latin: "Al-Munafiqun",   arab: "المنافقون",    ayahs: 11,  page: 554 },
  { n: 64, latin: "At-Taghabun",    arab: "التغابن",      ayahs: 18,  page: 556 },
  { n: 65, latin: "At-Talaq",       arab: "الطلاق",       ayahs: 12,  page: 558 },
  { n: 66, latin: "At-Tahrim",      arab: "التحريم",      ayahs: 12,  page: 560 },
  { n: 67, latin: "Al-Mulk",        arab: "الملك",        ayahs: 30,  page: 562 },
  { n: 68, latin: "Al-Qalam",       arab: "القلم",        ayahs: 52,  page: 564 },
  { n: 69, latin: "Al-Haqqah",      arab: "الحاقة",       ayahs: 52,  page: 566 },
  { n: 70, latin: "Al-Ma'arij",     arab: "المعارج",      ayahs: 44,  page: 568 },
  { n: 71, latin: "Nuh",            arab: "نوح",          ayahs: 28,  page: 570 },
  { n: 72, latin: "Al-Jinn",        arab: "الجن",         ayahs: 28,  page: 572 },
  { n: 73, latin: "Al-Muzzammil",   arab: "المزمل",       ayahs: 20,  page: 574 },
  { n: 74, latin: "Al-Muddaththir", arab: "المدثر",       ayahs: 56,  page: 575 },
  { n: 75, latin: "Al-Qiyamah",     arab: "القيامة",      ayahs: 40,  page: 577 },
  { n: 76, latin: "Al-Insan",       arab: "الإنسان",      ayahs: 31,  page: 578 },
  { n: 77, latin: "Al-Mursalat",    arab: "المرسلات",     ayahs: 50,  page: 580 },
  { n: 78, latin: "An-Naba",        arab: "النبأ",        ayahs: 40,  page: 582 },
  { n: 79, latin: "An-Nazi'at",     arab: "النازعات",     ayahs: 46,  page: 583 },
  { n: 80, latin: "'Abasa",         arab: "عبس",          ayahs: 42,  page: 585 },
  { n: 81, latin: "At-Takwir",      arab: "التكوير",      ayahs: 29,  page: 586 },
  { n: 82, latin: "Al-Infitar",     arab: "الإنفطار",     ayahs: 19,  page: 587 },
  { n: 83, latin: "Al-Mutaffifin",  arab: "المطففين",     ayahs: 36,  page: 587 },
  { n: 84, latin: "Al-Inshiqaq",    arab: "الإنشقاق",     ayahs: 25,  page: 589 },
  { n: 85, latin: "Al-Buruj",       arab: "البروج",       ayahs: 22,  page: 590 },
  { n: 86, latin: "At-Tariq",       arab: "الطارق",       ayahs: 17,  page: 591 },
  { n: 87, latin: "Al-A'la",        arab: "الأعلى",       ayahs: 19,  page: 591 },
  { n: 88, latin: "Al-Ghashiyah",   arab: "الغاشية",      ayahs: 26,  page: 592 },
  { n: 89, latin: "Al-Fajr",        arab: "الفجر",        ayahs: 30,  page: 593 },
  { n: 90, latin: "Al-Balad",       arab: "البلد",        ayahs: 20,  page: 594 },
  { n: 91, latin: "Ash-Shams",      arab: "الشمس",        ayahs: 15,  page: 595 },
  { n: 92, latin: "Al-Layl",        arab: "الليل",        ayahs: 21,  page: 595 },
  { n: 93, latin: "Ad-Duha",        arab: "الضحى",        ayahs: 11,  page: 596 },
  { n: 94, latin: "Ash-Sharh",      arab: "الشرح",        ayahs: 8,   page: 596 },
  { n: 95, latin: "At-Tin",         arab: "التين",        ayahs: 8,   page: 597 },
  { n: 96, latin: "Al-'Alaq",       arab: "العلق",        ayahs: 19,  page: 597 },
  { n: 97, latin: "Al-Qadr",        arab: "القدر",        ayahs: 5,   page: 598 },
  { n: 98, latin: "Al-Bayyinah",    arab: "البينة",       ayahs: 8,   page: 598 },
  { n: 99, latin: "Az-Zalzalah",    arab: "الزلزلة",      ayahs: 8,   page: 599 },
  { n: 100, latin: "Al-'Adiyat",    arab: "العاديات",     ayahs: 11,  page: 599 },
  { n: 101, latin: "Al-Qari'ah",    arab: "القارعة",      ayahs: 11,  page: 600 },
  { n: 102, latin: "At-Takathur",   arab: "التكاثر",      ayahs: 8,   page: 600 },
  { n: 103, latin: "Al-'Asr",       arab: "العصر",        ayahs: 3,   page: 601 },
  { n: 104, latin: "Al-Humazah",    arab: "الهمزة",       ayahs: 9,   page: 601 },
  { n: 105, latin: "Al-Fil",        arab: "الفيل",        ayahs: 5,   page: 601 },
  { n: 106, latin: "Quraysh",       arab: "قريش",         ayahs: 4,   page: 602 },
  { n: 107, latin: "Al-Ma'un",      arab: "الماعون",      ayahs: 7,   page: 602 },
  { n: 108, latin: "Al-Kawthar",    arab: "الكوثر",       ayahs: 3,   page: 602 },
  { n: 109, latin: "Al-Kafirun",    arab: "الكافرون",     ayahs: 6,   page: 602 },
  { n: 110, latin: "An-Nasr",       arab: "النصر",        ayahs: 3,   page: 603 },
  { n: 111, latin: "Al-Masad",      arab: "المسد",        ayahs: 5,   page: 603 },
  { n: 112, latin: "Al-Ikhlas",     arab: "الإخلاص",      ayahs: 4,   page: 603 },
  { n: 113, latin: "Al-Falaq",      arab: "الفلق",        ayahs: 5,   page: 604 },
  { n: 114, latin: "An-Nas",        arab: "الناس",        ayahs: 6,   page: 604 }
];

const TOTAL_PAGES = 604;

/* Halaman awal setiap juz (Mushaf Madani Standar Indonesia) */
const JUZ_PAGES = [1,22,42,62,82,102,121,142,162,182,201,221,241,261,281,301,321,341,361,381,401,421,441,461,481,501,521,541,561,581];

function getSurah(n) { return SURAHS.find(s => s.n === Number(n)); }

/* Halaman akhir sebuah surat */
function surahEndPage(n) {
  const idx = SURAHS.findIndex(s => s.n === Number(n));
  if (idx === SURAHS.length - 1) return TOTAL_PAGES;
  return SURAHS[idx + 1].page - 1;
}

/* Mapping ayat -> halaman (interpolasi linear dalam satu surat) */
function ayahToPage(surahNum, ayah) {
  const s = getSurah(surahNum);
  if (!s) return 1;
  ayah = Math.max(1, Math.min(ayah, s.ayahs));
  const start = s.page;
  const end = surahEndPage(s.n);
  if (s.ayahs <= 1) return start;
  const ratio = (ayah - 1) / (s.ayahs - 1);
  return Math.round(start + ratio * (end - start));
}

/* Halaman -> Juz */
function pageToJuz(page) {
  let juz = 1;
  for (let i = 0; i < JUZ_PAGES.length; i++) {
    if (page >= JUZ_PAGES[i]) juz = i + 1; else break;
  }
  return juz;
}

/* Range surah dalam satu juz untuk urutan hafalan */
const JUZ_SURAH_RANGE = {
  30: [78, 114], 29: [67, 77], 28: [58, 66], 27: [51, 57], 26: [46, 50]
};

function firstSurahOfJuz(juz) {
  if (JUZ_SURAH_RANGE[juz]) return JUZ_SURAH_RANGE[juz][0];
  // untuk juz 1-25: cari surah pertama yg mulai di halaman >= batas juz
  const page = JUZ_PAGES[juz - 1];
  for (let i = 0; i < SURAHS.length; i++) {
    if (SURAHS[i].page >= page) return SURAHS[i].n;
  }
  return 114;
}

function lastSurahOfJuz(juz) {
  if (JUZ_SURAH_RANGE[juz]) return JUZ_SURAH_RANGE[juz][1];
  const nextPage = juz < 30 ? JUZ_PAGES[juz] : TOTAL_PAGES + 1;
  for (let i = 0; i < SURAHS.length; i++) {
    if (SURAHS[i].page >= nextPage) return SURAHS[i - 1].n;
  }
  return 114;
}

/* Default urutan juz hafalan: 30 → 29 → 28 → 27 → 26 → 1 → 2 → 3 ... */
const DEFAULT_JUZ_ORDER = [30,29,28,27,26,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25];

function nextJuzInOrder(currentJuz, order) {
  const o = order || DEFAULT_JUZ_ORDER;
  const idx = o.indexOf(currentJuz);
  if (idx < 0 || idx >= o.length - 1) return null;
  return o[idx + 1];
}

/* Cari posisi auto-fill selanjutnya berdasarkan urutan juz */
function nextHafalanPosition(lastSurah, lastAyah, juzOrder) {
  const s = getSurah(lastSurah);
  if (!s) return { surah: 78, ayah: 1 }; // fallback ke juz 30
  const lastPage = ayahToPage(lastSurah, lastAyah);
  const currentJuz = pageToJuz(lastPage);
  const lastSurahOfCurrentJuz = lastSurahOfJuz(currentJuz);

  // masih di tengah surah
  if (lastAyah < s.ayahs) return { surah: lastSurah, ayah: lastAyah + 1 };

  // di akhir surah, cek apakah ini surah terakhir di juz ini
  if (lastSurah < lastSurahOfCurrentJuz) {
    // lanjut surah berikutnya (nomor urut)
    return { surah: lastSurah + 1, ayah: 1 };
  }

  // di ujung juz → pindah ke juz berikutnya sesuai urutan
  const next = nextJuzInOrder(currentJuz, juzOrder);
  if (!next) return { surah: lastSurah, ayah: lastAyah }; // gak ada lanjutan
  return { surah: firstSurahOfJuz(next), ayah: 1 };
}

/* Hitung total hafalan dari range surat:ayat -> surat:ayat
   Mengembalikan { ayahs, pages, juzStart, juzEnd, juzRange } */
function computeHafalan(startSurah, startAyah, endSurah, endAyah) {
  startSurah = Number(startSurah); endSurah = Number(endSurah);
  startAyah = Number(startAyah); endAyah = Number(endAyah);
  if (!getSurah(startSurah) || !getSurah(endSurah)) return null;
  if (startSurah > endSurah || (startSurah === endSurah && startAyah > endAyah)) {
    return null;
  }
  let ayahs = 0;
  if (startSurah === endSurah) {
    ayahs = endAyah - startAyah + 1;
  } else {
    const sStart = getSurah(startSurah);
    const sEnd = getSurah(endSurah);
    ayahs += sStart.ayahs - startAyah + 1;       // sisa surat awal
    for (let n = startSurah + 1; n < endSurah; n++) ayahs += getSurah(n).ayahs; // surat tengah
    ayahs += endAyah;                            // surat akhir
  }
  const pStart = ayahToPage(startSurah, startAyah);
  const pEnd = ayahToPage(endSurah, endAyah);
  const pages = Math.max(1, pEnd - pStart + 1);
  const juzStart = pageToJuz(pStart);
  const juzEnd = pageToJuz(pEnd);
  const juzRange = juzEnd - juzStart + 1;
  return { ayahs, pages, juzStart, juzEnd, juzRange };
}

/* Format ringkas total hafalan */
function formatHafalan(h) {
  if (!h) return '-';
  let parts = [];
  if (h.pages >= 1) parts.push(h.pages + ' halaman');
  if (h.juzRange >= 1) parts.push((h.juzRange === 1 ? 'Juz ' + h.juzStart : h.juzRange + ' juz'));
  if (!parts.length) parts.push(h.ayahs + ' ayat');
  return parts.join(' • ');
}
