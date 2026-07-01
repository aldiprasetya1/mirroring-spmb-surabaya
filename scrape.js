import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'smp_data.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
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

async function scrapeAll() {
  const smpData = [];
  const totalSchools = 63;
  console.log(`Starting to scrape ${totalSchools} schools...`);
  const startTime = Date.now();

  for (let id = 1; id <= totalSchools; id++) {
    const url = `https://smpapi2.spmbsurabaya.net/api/ranking/negeri/rapor/${id}`;
    process.stdout.write(`Fetching SMPN ${id} Surabaya... `);
    
    try {
      const result = await fetchWithRetry(url, 3, 500);
      
      if (result && result.success && result.data) {
        const d = result.data;
        const ranking = d.ranking || [];
        const pagu = d.pagu || 0;
        const jp_pilihan1 = d.jp_pilihan1 || 0;
        const jp_pilihan2 = d.jp_pilihan2 || 0;
        
        let highest_score = null;
        let lowest_score = null;
        
        if (ranking.length > 0) {
          // Score is formatted as string in API (e.g. "97.3148"), parse it to float
          highest_score = parseFloat(ranking[0].total);
          lowest_score = parseFloat(ranking[ranking.length - 1].total);
        }
        
        smpData.push({
          id: id,
          nama: `SMPN ${id} Surabaya`,
          pagu: pagu,
          jp_pilihan1: jp_pilihan1,
          jp_pilihan2: jp_pilihan2,
          total_pendaftar: jp_pilihan1 + jp_pilihan2,
          highest_score: highest_score,
          lowest_score: lowest_score,
          waktu_api: d.waktu,
          ranking: ranking.map(r => ({
            urutan: parseInt(r.urutan),
            nama_siswa: r.nama_siswa,
            total: parseFloat(r.total),
            pilihan_ke: parseInt(r.pilihan_ke),
            bind: parseFloat(r.bind || 0),
            mat: parseFloat(r.mat || 0),
            ipa: parseFloat(r.ipa || 0),
            waktu_pendaftaran: r.waktu_pendaftaran
          }))
        });
        
        console.log(`Success! (Pagu: ${pagu}, Applicants in rank: ${ranking.length}, Min: ${lowest_score})`);
      } else {
        console.log(`Failed. API response was not successful.`);
      }
    } catch (error) {
      console.log(`Failed. Error: ${error.message}`);
    }
    
    // Respect rate limits, wait 200ms between calls
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\nScraping finished in ${duration}s!`);
  
  const payload = {
    last_updated: new Date().toISOString(),
    schools: smpData
  };
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`Saved compiled data to ${OUTPUT_FILE}`);
}

scrapeAll().catch(err => {
  console.error("Critical error in scraper:", err);
});
