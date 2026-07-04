import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const OUTPUT_RAPOR = path.join(DATA_DIR, 'smp_data.json');
const OUTPUT_DOMISILI_1 = path.join(DATA_DIR, 'smp_data_domisili_1.json');
const OUTPUT_DOMISILI_2 = path.join(DATA_DIR, 'smp_data_domisili_2.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Origin': 'https://smp.spmbsurabaya.net',
  'Referer': 'https://smp.spmbsurabaya.net/'
};

async function fetchWithRetry(url, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`HTTP status ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.warn(`[Attempt ${i + 1}/${retries}] Failed to fetch ${url}: ${error.message}`);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
}

function parseChoicesSum(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  if (Array.isArray(val)) return val.length;
  if (typeof val === 'object') {
    return Object.values(val).reduce((sum, curr) => sum + (typeof curr === 'number' ? curr : 0), 0);
  }
  return 0;
}

async function scrapeJalur(apiUrlPath, filename, nameLabel) {
  const smpData = [];
  const totalSchools = 63;
  console.log(`Starting to scrape ${nameLabel} for ${totalSchools} schools...`);
  const startTime = Date.now();

  for (let id = 1; id <= totalSchools; id++) {
    const url = `https://smpapi2.spmbsurabaya.net/api/ranking/negeri/${apiUrlPath}/${id}`;
    process.stdout.write(`[${nameLabel}] Fetching SMPN ${id} Surabaya... `);
    
    try {
      const result = await fetchWithRetry(url, 3, 500);
      
      if (result && result.success && result.data) {
        const d = result.data;
        const ranking = d.ranking || [];
        const pagu = d.pagu || 0;
        
        let highest_score = null;
        let lowest_score = null;
        
        const isDomisili = apiUrlPath.includes('domisili');
        
        if (ranking.length > 0) {
          if (isDomisili) {
            // Jarak is formatted as string or number in API, parse it to float
            highest_score = parseFloat(ranking[0].jarak || 0); // Terdekat (Min Jarak)
            lowest_score = parseFloat(ranking[ranking.length - 1].jarak || 0); // Terjauh (Max Jarak)
          } else {
            highest_score = parseFloat(ranking[0].total || 0);
            lowest_score = parseFloat(ranking[ranking.length - 1].total || 0);
          }
        }
        
        const jp1 = parseChoicesSum(d.jp_pilihan1);
        const jp2 = parseChoicesSum(d.jp_pilihan2);

        smpData.push({
          id: id,
          nama: `SMPN ${id} Surabaya`,
          pagu: pagu,
          jp_pilihan1: jp1,
          jp_pilihan2: jp2,
          total_pendaftar: jp1 + jp2,
          highest_score: highest_score,
          lowest_score: lowest_score,
          waktu_api: d.waktu,
          ranking: ranking.map(r => {
            const mapped = {
              urutan: parseInt(r.urutan),
              nama_siswa: r.nama_siswa,
              pilihan_ke: parseInt(r.pilihan_ke),
              waktu_pendaftaran: r.waktu_pendaftaran,
              sekolah_asal: r.sekolah_asal || ''
            };
            if (isDomisili) {
              mapped.jarak = parseFloat(r.jarak || 0);
              if (r.asal_kelurahan) {
                mapped.asal_kelurahan = r.asal_kelurahan;
              }
            } else {
              mapped.total = parseFloat(r.total || 0);
              mapped.bind = parseFloat(r.bind || 0);
              mapped.mat = parseFloat(r.mat || 0);
              mapped.ipa = parseFloat(r.ipa || 0);
            }
            return mapped;
          })
        });
        
        console.log(`Success! (Pagu: ${pagu}, Rank: ${ranking.length}, Min/Max: ${lowest_score})`);
      } else {
        console.log(`Failed. API response was not successful.`);
      }
    } catch (error) {
      console.log(`Failed. Error: ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[${nameLabel}] Scrape finished in ${duration}s!`);
  
  const payload = {
    last_updated: new Date().toISOString(),
    schools: smpData
  };
  
  fs.writeFileSync(filename, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`Saved ${nameLabel} data to ${filename}\n`);
}

async function scrapeAll() {
  await scrapeJalur('rapor', OUTPUT_RAPOR, 'Rapor');
  await scrapeJalur('domisili', OUTPUT_DOMISILI_1, 'Domisili 1');
  await scrapeJalur('domisili-khusus', OUTPUT_DOMISILI_2, 'Domisili 2');
}

scrapeAll().catch(err => {
  console.error("Critical error in scraper:", err);
});
