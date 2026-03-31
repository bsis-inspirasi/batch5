/* =========================================================
   SUPABASE CONFIG
========================================================= */

const SUPABASE_URL = "https://iyfwaqwmnmjfagszttts.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5ZndhcXdtbm1qZmFnc3p0dHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NTEwMTgsImV4cCI6MjA4MzQyNzAxOH0.f2xb_aQDIj4tIPKwTTC9dgIi-9qFv0G252T5uo9XwXo";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/* =========================================================
   GLOBAL STATE
========================================================= */

let mahasiswaData = null;
let formsConfig = null;

/* =========================================================
   LOAD JSON HELPER
========================================================= */

async function loadJson(path) {
    const res = await fetch(path);
    if (!res.ok) {
        throw new Error(`Gagal load ${path}: ${res.status}`);
    }
    return await res.json();
}

/* =========================================================
   LOAD DATA FROM SUPABASE
========================================================= */

async function ensureDataLoaded() {
    if (mahasiswaData) return;

    const { data, error } = await supabaseClient
        .from("mahasiswa_bsi")
        .select("no_induk, nama, kampus, kelompok, status");

    console.log("SUPABASE DATA:", data);
    console.log("SUPABASE ERROR:", error);

    if (error) {
        throw error;
    }

    mahasiswaData = (data || []).map((m) => ({
        nim: String(m.no_induk || "").trim(),
        nama: m.nama || "",
        kampus: m.kampus || "",
        kelompok: m.kelompok || ""
    }));
}

/* =========================================================
   BANNER MONTH
========================================================= */

function setBannerMonthIfExists() {
    const el = document.getElementById("alert-month");
    if (!el) return;

    const now = new Date();
    const monthNames = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    el.textContent = ` (Periode bulan ${monthNames[now.getMonth()]} ${now.getFullYear()})`;
}

/* =========================================================
   INIT FORM PAGE
========================================================= */

async function initFormPage(slug) {
    const resultEl = document.getElementById("cek-result");

    try {
        await ensureDataLoaded();
    } catch (err) {
        console.error(err);
        if (resultEl) {
            resultEl.innerHTML = `
                <div class="error-box">
                    Terjadi kesalahan saat memuat data awal.
                    Silakan refresh halaman atau hubungi admin.
                </div>
            `;
        }
        return;
    }

    setBannerMonthIfExists();

    if (!formsConfig || !formsConfig[slug]) {
        if (resultEl) {
            resultEl.innerHTML = `
                <div class="error-box">
                    Konfigurasi form untuk halaman ini belum tersedia.
                </div>
            `;
        }
    }
}

/* =========================================================
   HANDLE FORM SUBMIT (VERIFIKASI SUPABASE)
========================================================= */

async function handleFormSubmit(event) {
    event.preventDefault();

    const body = document.body;
    const slug = body.dataset.formSlug;
    const nimInput = document.getElementById("nim");
    const resultEl = document.getElementById("cek-result");

    if (!nimInput || !resultEl) return false;

    const nim = (nimInput.value || "").trim();

    if (!nim) {
        resultEl.innerHTML = `
            <div class="error-box">
                Nomor Induk tidak boleh kosong.
            </div>
        `;
        return false;
    }

    const supabase = window.supabaseClient;
    if (!supabase) {
        resultEl.innerHTML = `
            <div class="error-box">
                Koneksi database tidak tersedia.
            </div>
        `;
        return false;
    }

    /* ---- QUERY DATA MAHASISWA ---- */
    const { data, error } = await supabase
        .from("mahasiswa_bsi")
        .select("no_induk, nama, kampus, kelompok, status")
        .ilike("no_induk", nim)
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error("Supabase error:", error);
        resultEl.innerHTML = `
            <div class="error-box">
                Terjadi kesalahan saat verifikasi data.
                Silakan coba lagi.
            </div>
        `;
        return false;
    }

    if (!data) {
        resultEl.innerHTML = `
            <div class="error-box">
                No Induk <strong>${nim}</strong> tidak ditemukan.
                Pastikan data benar atau hubungi admin.
            </div>
        `;
        return false;
    }

    /* ---- NORMALISASI DATA ---- */
    const found = {
        nim: String(data.no_induk || "").trim(),
        nama: data.nama || "",
        kampus: data.kampus || "",
        kelompok: data.kelompok || "",
        status: data.status || ""
    };

    /* ---- FORM CONFIG ---- */
    const cfg = formsConfig && formsConfig[slug];
    if (!cfg || !cfg.form_url || !cfg.prefill) {
        resultEl.innerHTML = `
            <div class="error-box">
                Konfigurasi form belum lengkap.
            </div>
        `;
        return false;
    }

    /* ---- BUILD PREFILL URL ---- */
    const params = new URLSearchParams();
    if (cfg.prefill.nim) params.set(cfg.prefill.nim, found.nim);
    if (cfg.prefill.nama) params.set(cfg.prefill.nama, found.nama);
    if (cfg.prefill.kampus) params.set(cfg.prefill.kampus, found.kampus);
    if (cfg.prefill.kelompok) params.set(cfg.prefill.kelompok, found.kelompok);

    const finalUrl = cfg.form_url.includes("?")
        ? `${cfg.form_url}&${params.toString()}`
        : `${cfg.form_url}?${params.toString()}`;

    /* ---- RESULT UI ---- */
    resultEl.innerHTML = `
        <div class="result-card">
            <p><strong>Identitas ditemukan:</strong></p>

            <div class="result-table">
                <div class="label">No Induk</div><div class="colon">:</div><div class="value">${found.nim}</div>
                <div class="label">Nama</div><div class="colon">:</div><div class="value value--bold">${found.nama || "-"}</div>
                <div class="label">Kampus</div><div class="colon">:</div><div class="value">${found.kampus || "-"}</div>
                <div class="label">Kelompok</div><div class="colon">:</div><div class="value">${found.kelompok || "-"}</div>
            </div>

            <br/>
            <a class="btn btn-primary btn-full"
               href="${finalUrl}"
               target="_blank"
               rel="noopener">
                Buka Google Form &amp; Lanjutkan →
            </a>
        </div>
    `;

    return false;
}


/* =========================================================
   CHANGE NUMBER PAGE
========================================================= */

async function handleChangeNumber(event) {
    event.preventDefault();

    const nimInput = document.getElementById("nim-change");
    const resultEl = document.getElementById("change-number-result");

    if (!nimInput || !resultEl) return false;

    const nim = (nimInput.value || "").trim();

    if (!nim) {
        resultEl.innerHTML = `
            <div class="error-box">
                Nomor Induk tidak boleh kosong.
            </div>
        `;
        return false;
    }

    try {
        await ensureDataLoaded();
    } catch (err) {
        console.error(err);
        resultEl.innerHTML = `
            <div class="error-box">
                Gagal memuat data mahasiswa.
            </div>
        `;
        return false;
    }

    const found = mahasiswaData.find(
        (m) => m.nim.toUpperCase() === nim.toUpperCase()
    );

    if (!found) {
        resultEl.innerHTML = `
            <div class="error-box">
                No Induk <strong>${nim}</strong> tidak ditemukan.
            </div>
        `;
        return false;
    }

    const cfg = formsConfig && formsConfig["lapor"];
    if (!cfg || !cfg.form_url || !cfg.prefill) {
        resultEl.innerHTML = `
            <div class="error-box">
                Konfigurasi form lapor belum lengkap.
            </div>
        `;
        return false;
    }

    const params = new URLSearchParams();
    if (cfg.prefill.nim) params.set(cfg.prefill.nim, found.nim);
    if (cfg.prefill.nama) params.set(cfg.prefill.nama, found.nama);
    if (cfg.prefill.kampus) params.set(cfg.prefill.kampus, found.kampus);
    if (cfg.prefill.kelompok) params.set(cfg.prefill.kelompok, found.kelompok);

    const finalUrl = cfg.form_url.includes("?")
        ? `${cfg.form_url}&${params.toString()}`
        : `${cfg.form_url}?${params.toString()}`;

    resultEl.innerHTML = `
        <div class="result-card">
            <p>Data ditemukan.</p>
            <a class="btn btn-primary btn-full"
               href="${finalUrl}"
               target="_blank"
               rel="noopener">
                Buka Form Lapor →
            </a>
        </div>
    `;

    return false;
}

/* =========================================================
   PAGE INIT
========================================================= */

async function initPage() {
    const body = document.body;
    const page = body.dataset.page;

    try {
        formsConfig = await loadJson("config/forms.json");
    } catch (err) {
        console.error("Gagal load forms.json", err);
    }

    if (page === "form") {
        const slug = body.dataset.formSlug;
        if (slug) initFormPage(slug);
    }
}

/* =========================================================
   NAV
========================================================= */

function toggleNav() {
    const nav = document.getElementById("mobileNav");
    if (nav) nav.classList.toggle("nav--open");
}

/* =========================================================
   EXPORT
========================================================= */

document.addEventListener("DOMContentLoaded", initPage);

window.handleFormSubmit = handleFormSubmit;
window.handleChangeNumber = handleChangeNumber;
window.toggleNav = toggleNav;


/* =========================================================
   AUTOCOMPLETE NIM / NAMA / KAMPUS (SUPABASE QUERY)
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("nim");
    const box = document.getElementById("nim-suggestions");

    if (!input || !box) return;

    // pakai client yang SUDAH Anda buat
    const supabase = window.supabaseClient;

    if (!supabase) {
        console.error("Supabase client tidak ditemukan");
        return;
    }

    let debounceTimer;
    const DEBOUNCE_DELAY = 300;

    input.addEventListener("input", () => {
        clearTimeout(debounceTimer);

        const keyword = input.value.trim();
        if (keyword.length < 2) {
            box.style.display = "none";
            return;
        }

        debounceTimer = setTimeout(() => {
            fetchSuggestions(keyword);
        }, DEBOUNCE_DELAY);
    });

    async function fetchSuggestions(keyword) {
        const { data, error } = await supabase
            .from("mahasiswa_bsi")
            .select("no_induk, nama, kampus")
            .or(
                `no_induk.ilike.%${keyword}%,nama.ilike.%${keyword}%,kampus.ilike.%${keyword}%`
            )
            .order("no_induk", { ascending: true })
            .limit(10);

        if (error) {
            console.error("Autocomplete error:", error);
            box.style.display = "none";
            return;
        }

        if (!data || data.length === 0) {
            box.style.display = "none";
            return;
        }

        box.innerHTML = data.map(m => `
            <div class="nim-suggestion-item" data-nim="${m.no_induk}">
                <strong>${m.no_induk}</strong>
                <span>${m.nama || "-"} — ${m.kampus || "-"}</span>
            </div>
        `).join("");

        box.style.display = "block";
    }

    box.addEventListener("click", e => {
        const item = e.target.closest(".nim-suggestion-item");
        if (!item) return;

        input.value = item.dataset.nim;
        box.style.display = "none";
    });

    document.addEventListener("click", e => {
        if (!e.target.closest(".nim-field-wrapper")) {
            box.style.display = "none";
        }
    });
});
