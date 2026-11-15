import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, query, limitToLast, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ISI dengan config project kamu (Project settings > Your apps > Web app)
const cfg = {
  apiKey: "AIzaSyCmCEJ17rooHV_DH78ZRSPfFBdsVyQXeWU",
  databaseURL: "https://kontrol-ruang-kelas-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "Kontrol Ruang"
};

const app = initializeApp(cfg), db = getDatabase(app), auth = getAuth(app);
const $ = i => document.getElementById(i);
const T = (i, v) => { const e = $(i); if (e) e.textContent = v; };
const H = (i, v) => { const e = $(i); if (e) e.innerHTML = v; };
const cls = { "Nyaman": "ok", "Waspada": "warn", "Tidak nyaman": "bad", "Nonaktif": "off" };
const badge = s => `<span class="badge ${cls[s] || "off"}">${s}</span>`;
const dt = t => new Date(t).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const page = document.body.dataset.page;

let last = 0, L = null, draw = () => {};
const setOnline = () => {
  const on = Date.now() - last < 30000;
  $("online").classList.toggle("on-line", on);
  $("online").lastElementChild.textContent = on ? "Perangkat online" : "Perangkat offline";
};
setInterval(setOnline, 3000);

// Data terkini (kedua halaman)
onValue(ref(db, "kelas/latest"), s => {
  const d = L = s.val(); if (!d) return;
  last = Date.now();
  T("temp", d.temp.toFixed(1) + (page === "control" ? " °C" : ""));
  T("hum", d.hum.toFixed(0) + (page === "control" ? " %" : ""));
  T("inside", d.inside); T("in", d.in); T("out", d.out);
  T("io", d.in + " / " + d.out);
  T("mode", d.mode === "manual" ? "Manual" : "Otomatis");
  T("ledS", d.led ? "Nyala" : "Mati"); T("buzS", d.buzzer ? "Nyala" : "Mati");
  T("upd", dt(d.ts));
  H("status", badge(d.status));
  setOnline(); draw();
});

if (page === "control") {
  const ctl = (k, v) => update(ref(db, "kelas/control"), { [k]: v }).catch(e => alert("Gagal: " + e.message));
  let C = { system: true, mode: "auto", led: false, buzzer: false };
  const sync = () => {
    const ok = !!auth.currentUser;
    $("sys").checked = C.system; $("led").checked = C.led; $("buz").checked = C.buzzer;
    document.querySelectorAll(".seg button").forEach(b => { b.classList.toggle("on", b.dataset.m === C.mode); b.disabled = !ok; });
    $("sys").disabled = $("reset").disabled = !ok;
    $("led").disabled = $("buz").disabled = !(ok && C.system && C.mode === "manual");
  };
  onValue(ref(db, "kelas/control"), s => { C = { ...C, ...s.val() }; sync(); });
  onAuthStateChanged(auth, u => { document.body.classList.toggle("authed", !!u); T("who", u ? u.email : ""); sync(); });
  $("sys").onchange = e => ctl("system", e.target.checked);
  $("led").onchange = e => ctl("led", e.target.checked);
  $("buz").onchange = e => ctl("buzzer", e.target.checked);
  document.querySelectorAll(".seg button").forEach(b => b.onclick = () => ctl("mode", b.dataset.m));
  $("reset").onclick = () => confirm("Reset hitungan orang ke 0?") && ctl("reset", true);
  $("login").onsubmit = async e => {
    e.preventDefault(); T("err", "");
    try { await signInWithEmailAndPassword(auth, $("em").value, $("pw").value); }
    catch { T("err", "Login gagal: periksa email dan password."); }
  };
  $("logout").onclick = () => signOut(auth);
} else {
  let rows = [], tab = "live";
  const span = { h1: 36e5, h24: 864e5 };
  const view = () => tab === "live" ? rows.slice(-30) : span[tab] ? rows.filter(x => x.ts > Date.now() - span[tab]) : rows;
  const st = (r, k) => {
    const v = r.map(x => x[k]).filter(Number.isFinite);
    return v.length ? { mn: Math.min(...v), mx: Math.max(...v), av: v.reduce((a, b) => a + b, 0) / v.length } : { mn: 0, mx: 0, av: 0 };
  };
  const spark = (id, v) => {
    const e = $(id); if (v.length < 2) { e.innerHTML = ""; return; }
    const mn = Math.min(...v), r = Math.max(...v) - mn || 1;
    e.innerHTML = `<polyline fill="none" stroke="#ff8a8a" stroke-width="2" vector-effect="non-scaling-stroke" points="${v.map((y, i) => `${i * 100 / (v.length - 1)},${26 - (y - mn) / r * 24}`).join(" ")}"/>`;
  };
  draw = () => {
    const r = view(), t = st(r, "temp"), h = st(r, "hum"), p = st(r, "inside");
    T("tmn", t.mn.toFixed(1)); T("tmx", t.mx.toFixed(1)); T("tav", t.av.toFixed(1));
    T("hmn", h.mn.toFixed(0)); T("hmx", h.mx.toFixed(0)); T("hav", h.av.toFixed(0));
    T("pmx", p.mx); T("pin", L ? L.in : 0); T("pout", L ? L.out : 0);
    T("avgT", t.av.toFixed(1) + " °C");
    spark("s1", r.map(x => x.in)); spark("s2", r.map(x => x.out)); spark("s3", r.map(x => x.temp));
    H("rows", r.slice(-15).reverse().map(x =>
      `<tr><td>${dt(x.ts)}</td><td>${x.temp.toFixed(1)} °C</td><td>${x.hum.toFixed(0)} %</td><td>${x.inside}</td><td>${x.in} / ${x.out}</td><td>${badge(x.status)}</td></tr>`).join(""));
  };
  onValue(query(ref(db, "kelas/log"), limitToLast(300)), s => {
    rows = Object.values(s.val() || {}).filter(x => x.ts).sort((a, b) => a.ts - b.ts); draw();
  });
  document.querySelectorAll(".tabs button").forEach(b => b.onclick = () => {
    tab = b.dataset.t;
    document.querySelectorAll(".tabs button").forEach(x => x.classList.toggle("on", x === b));
    draw();
  });
  $("csv").onclick = () => {
    const csv = "waktu,suhu,kelembapan,di_dalam,masuk,keluar,status\n" +
      view().map(x => [new Date(x.ts).toISOString(), x.temp, x.hum, x.inside, x.in, x.out, x.status].join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "data-kelas.csv"; a.click();
  };
}