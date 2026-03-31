/* =========================================================
   SUPABASE CONFIG
========================================================= */
const SUPABASE_URL = "https://iyfwaqwmnmjfagszttts.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5ZndhcXdtbm1qZmFnc3p0dHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NTEwMTgsImV4cCI6MjA4MzQyNzAxOH0.f2xb_aQDIj4tIPKwTTC9dgIi-9qFv0G252T5uo9XwXo";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabaseClient = supabaseClient;

/* =========================================================
   GLOBAL STATE
========================================================= */
let formsConfig = null;
let selectedAwardee = null; 
let finalFormUrl = ""; 

/* =========================================================
   LOAD JSON HELPER & INIT
========================================================= */
async function loadJson(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Gagal load ${path}`);
    return await res.json();
}

async function initPage() {
    try {
        formsConfig = await loadJson("config/forms.json");
        console.log("Config loaded:", formsConfig);
    } catch (err) {
        console.error("Gagal load forms.json", err);
    }
}

/* =========================================================
   AUTOCOMPLETE LOGIC
========================================================= */
document.addEventListener("DOMContentLoaded", () => {
    initPage(); // Load config forms.json saat halaman dibuka
    
    const input = document.getElementById("nim");
    const box = document.getElementById("nim-suggestions");

    if (!input || !box) return;

    let debounceTimer;

    input.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        const keyword = input.value.trim();
        if (keyword.length < 2) {
            box.style.display = "none";
            return;
        }

        debounceTimer = setTimeout(() => {
            fetchSuggestions(keyword);
        }, 300);
    });

    async function fetchSuggestions(keyword) {
        const { data, error } = await supabaseClient
            .from("mahasiswa_bsi")
            .select("no_induk, nama, kampus, kelompok")
            .or(`no_induk.ilike.%${keyword}%,nama.ilike.%${keyword}%,kampus.ilike.%${keyword}%`)
            .limit(10);

        if (error || !data || data.length === 0) {
            box.style.display = "none";
            return;
        }

        box.innerHTML = data.map(m => `
            <div class="nim-suggestion-item" 
                 data-nim="${m.no_induk}" 
                 data-nama="${m.nama}" 
                 data-kampus="${m.kampus}"
                 data-kelompok="${m.kelompok || '-'}">
                <strong>${m.no_induk}</strong>
                <span>${m.nama} — ${m.kampus}</span>
            </div>
        `).join("");
        box.style.display = "block";
    }

    box.addEventListener("click", e => {
        const item = e.target.closest(".nim-suggestion-item");
        if (!item) return;

        // Simpan data ke Global State saat di-klik
        selectedAwardee = {
            nim: item.dataset.nim,
            nama: item.dataset.nama,
            kampus: item.dataset.kampus,
            kelompok: item.dataset.kelompok
        };

        input.value = selectedAwardee.nim;
        box.style.display = "none";
    });

    // Sembunyikan box jika klik di luar
    document.addEventListener("click", e => {
        if (!e.target.closest(".nim-field-wrapper")) box.style.display = "none";
    });
});

/* =========================================================
   VERIFIKASI & NAVIGATION (STEP 1 KE STEP 2)
========================================================= */

window.handleVerification = function(event) {
    if (event) event.preventDefault();
    
    if (!selectedAwardee) {
        alert("Silakan ketik nama dan pilih dari daftar yang muncul!");
        return false;
    }

    // Sembunyikan banner perhatian
    const banner = document.getElementById('form-banner');
    if (banner) banner.style.display = 'none';

    // Ambil slug form dari HTML (Contoh: 'pembinaan')
    const slug = document.body.dataset.formSlug;
    const cfg = formsConfig && formsConfig[slug];

    if (!cfg) {
        console.error("Konfigurasi untuk slug", slug, "tidak ditemukan di forms.json");
        alert(`Konfigurasi form belum diatur atau file forms.json gagal dimuat. Hubungi Admin.`);
        
        // Kembalikan banner jika gagal
        if (banner) banner.style.display = 'block';
        return false;
    }

    // 1. Update UI Halaman Validasi (Step 2)
    document.getElementById('v-nama').innerText = selectedAwardee.nama;
    document.getElementById('v-nim').innerText = selectedAwardee.nim;
    document.getElementById('v-univ').innerText = "📍 " + selectedAwardee.kampus;
    
    // Inisial avatar (Contoh: Agusti Ario -> AA)
    const initials = selectedAwardee.nama.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
 

    // 2. Generate Google Form URL dengan Prefill
    if (cfg.form_url && cfg.prefill) {
        const params = new URLSearchParams();
        if (cfg.prefill.nim) params.set(cfg.prefill.nim, selectedAwardee.nim);
        if (cfg.prefill.nama) params.set(cfg.prefill.nama, selectedAwardee.nama);
        if (cfg.prefill.kampus) params.set(cfg.prefill.kampus, selectedAwardee.kampus);
        if (cfg.prefill.kelompok) params.set(cfg.prefill.kelompok, selectedAwardee.kelompok);

        finalFormUrl = cfg.form_url.includes("?") 
            ? `${cfg.form_url}&${params.toString()}` 
            : `${cfg.form_url}?${params.toString()}`;
    }

    // 3. Pindah Tampilan
    document.getElementById('section-input').style.display = 'none';
    document.getElementById('section-validation').style.display = 'block';
    
    return false;
};

window.cancelVerification = function() {
    // Reset data
    selectedAwardee = null;
    document.getElementById('nim').value = "";
    
    // Munculkan kembali banner perhatian
    const banner = document.getElementById('form-banner');
    if (banner) banner.style.display = 'block'; 

    // Balik ke Step 1
    document.getElementById('section-validation').style.display = 'none';
    document.getElementById('section-input').style.display = 'block';
};

window.goToGoogleForm = function() {
    if (finalFormUrl) {
        window.open(finalFormUrl, '_blank'); // Buka di tab baru
    } else {
        alert("Link form tidak ditemukan. Pastikan forms.json terkonfigurasi dengan benar.");
    }
};

/* =========================================================
   UI HELPER
========================================================= */
window.toggleNav = () => {
    const nav = document.getElementById("mobileNav");
    if (nav) nav.classList.toggle("nav--open");
};
