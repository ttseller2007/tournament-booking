const times = [
  "13:00",
  "15:00",
  "17:00",
  "19:00",
  "21:00",
  "23:00",
  "01:00"
];

const adminDate = document.getElementById("adminDate");

function localDateString() {
  const d = new Date();

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

adminDate.value = localDateString();


// ============================
// LOGIN
// ============================

async function login() {
  const email = document
    .getElementById("email")
    .value
    .trim();

  const password = document
    .getElementById("password")
    .value;

  const msg = document.getElementById("loginMsg");

  if (!email || !password) {
    msg.textContent = "กรอก Email และ Password";
    return;
  }

  msg.textContent = "กำลังเข้าสู่ระบบ...";

  const { data, error } =
    await window.sb.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    console.error(error);

    msg.textContent =
      "เข้าสู่ระบบไม่สำเร็จ: " + error.message;

    return;
  }

  const isAdmin = await checkAdmin();

  if (!isAdmin) {
    await window.sb.auth.signOut();

    msg.textContent =
      "บัญชีนี้ไม่มีสิทธิ์ Admin";

    return;
  }

  showPanel();
}


// ============================
// CHECK ADMIN
// ============================

async function checkAdmin() {
  const {
    data: { user }
  } = await window.sb.auth.getUser();

  if (!user) {
    return false;
  }

  const { data, error } =
    await window.sb
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

  if (error) {
    console.error(error);
    return false;
  }

  return !!data;
}


// ============================
// SHOW ADMIN PANEL
// ============================

function showPanel() {
  document
    .getElementById("login")
    .classList.add("hidden");

  document
    .getElementById("panel")
    .classList.remove("hidden");

  loadAdmin();
}


// ============================
// LOGOUT
// ============================

async function logout() {
  await window.sb.auth.signOut();

  document
    .getElementById("panel")
    .classList.add("hidden");

  document
    .getElementById("login")
    .classList.remove("hidden");

  document.getElementById("loginMsg").textContent =
    "ออกจากระบบแล้ว";
}


// ============================
// LOAD ADMIN DATA
// ============================

async function loadAdmin() {
  const date = adminDate.value;

  if (!date) {
    return;
  }

  await loadStats(date);
  await loadApplications(date);
}


// ============================
// LOAD COUNTS
// ============================

async function loadStats(date) {
  const { data, error } =
    await window.sb.rpc(
      "get_tournament_slots",
      {
        p_date: date
      }
    );

  if (error) {
    console.error(error);
    return;
  }

  times.forEach(time => {
    const slot = (data || []).find(
      x => String(x.match_time).slice(0, 5) === time
    );

    const id =
      "s" + time.replace(":", "");

    const el = document.getElementById(id);

    if (!el) {
      return;
    }

    if (!slot) {
      el.textContent = "0/8";
      return;
    }

    el.textContent =
      `${Number(slot.team_count || 0)}/${slot.max_teams}`;
  });
}


// ============================
// LOAD APPLICATIONS
// ============================

async function loadApplications(date) {
  const list = document.getElementById("list");

  list.innerHTML = `
    <div class="card">
      กำลังโหลดรายการสมัคร...
    </div>
  `;

  const { data, error } =
    await window.sb
      .from("applications")
      .select(`
        id,
        tournament_id,
        game_name,
        line_id,
        slip_path,
        status,
        created_at,
        tournaments (
          match_date,
          match_time
        )
      `)
      .eq("tournaments.match_date", date)
      .order("created_at", {
        ascending: false
      });

  if (error) {
    console.error(error);

    list.innerHTML = `
      <div class="card">
        <b>โหลดข้อมูลไม่สำเร็จ</b>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;

    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = `
      <div class="card">
        ยังไม่มีรายการสมัครสำหรับวันที่ ${date}
      </div>
    `;

    return;
  }

  const rows = [];

  for (const item of data) {
    let slipUrl = "";

    if (item.slip_path) {
      const { data: signedData, error: signedError } =
        await window.sb.storage
          .from("slips")
          .createSignedUrl(
            item.slip_path,
            600
          );

      if (!signedError && signedData) {
        slipUrl = signedData.signedUrl;
      }
    }

    const time = item.tournaments
      ? String(item.tournaments.match_time).slice(0, 5)
      : "-";

    rows.push({
      ...item,
      time,
      slipUrl
    });
  }

  list.innerHTML = rows.map(renderApplication).join("");
}


// ============================
// RENDER APPLICATION
// ============================

function renderApplication(item) {
  const statusText = {
    pending: "รอตรวจสอบ",
    approved: "ยืนยันแล้ว",
    rejected: "ปฏิเสธ",
    withdrawn: "ถอน/ยกเลิก"
  };

  const status =
    statusText[item.status] || item.status;

  const slipHtml = item.slipUrl
    ? `
      <div>
        <p><b>สลิปการโอนเงิน</b></p>

        <a
          href="${escapeAttribute(item.slipUrl)}"
          target="_blank"
          rel="noopener"
        >
          <img
            class="slip"
            src="${escapeAttribute(item.slipUrl)}"
            alt="สลิปการโอนเงิน"
          >
        </a>

        <p>
          <a
            href="${escapeAttribute(item.slipUrl)}"
            target="_blank"
            rel="noopener"
          >
            🔍 เปิดดูสลิปขนาดใหญ่
          </a>
        </p>
      </div>
    `
    : `
      <p>ไม่พบไฟล์สลิป</p>
    `;

  return `
    <div class="row">

      <h3>
        ${escapeHtml(item.time)}
      </h3>

      <div>
        <label>ชื่อในเกม</label>

        <input
          id="game-${item.id}"
          value="${escapeAttribute(item.game_name)}"
        >
      </div>

      <div>
        <label>ID LINE</label>

        <input
          id="line-${item.id}"
          value="${escapeAttribute(item.line_id)}"
        >
      </div>

      <div>
        <b>สถานะ:</b>
        ${escapeHtml(status)}
      </div>

      ${slipHtml}

      <div class="actions">

        <button
          class="ok"
          onclick="setStatus(${item.id}, 'approved')"
        >
          ✅ ยืนยันสลิป
        </button>

        <button
          onclick="setStatus(${item.id}, 'rejected')"
        >
          ❌ ปฏิเสธ
        </button>

        <button
          class="danger"
          onclick="setStatus(${item.id}, 'withdrawn')"
        >
          🚫 ถอน/ยกเลิก
        </button>

        <button
          onclick="saveEdit(${item.id})"
        >
          💾 บันทึกข้อมูล
        </button>

      </div>

    </div>
  `;
}


// ============================
// CHANGE STATUS
// ============================

async function setStatus(id, status) {
  const names = {
    approved: "ยืนยันสลิป",
    rejected: "ปฏิเสธ",
    withdrawn: "ถอน/ยกเลิก"
  };

  const answer = confirm(
    `ต้องการ${names[status]}รายการนี้หรือไม่?`
  );

  if (!answer) {
    return;
  }

  const { error } =
    await window.sb
      .from("applications")
      .update({
        status
      })
      .eq("id", id);

  if (error) {
    console.error(error);

    alert(
      "ดำเนินการไม่สำเร็จ: " +
      error.message
    );

    return;
  }

  alert("บันทึกเรียบร้อยแล้ว");

  await loadAdmin();
}


// ============================
// EDIT GAME NAME / LINE ID
// ============================

async function saveEdit(id) {
  const gameInput =
    document.getElementById(`game-${id}`);

  const lineInput =
    document.getElementById(`line-${id}`);

  if (!gameInput || !lineInput) {
    return;
  }

  const gameName =
    gameInput.value.trim();

  const lineId =
    lineInput.value.trim();

  if (!gameName || !lineId) {
    alert("กรอกชื่อในเกมและ LINE ID ให้ครบ");
    return;
  }

  if (gameName.length > 100) {
    alert("ชื่อในเกมยาวเกินไป");
    return;
  }

  if (lineId.length > 100) {
    alert("LINE ID ยาวเกินไป");
    return;
  }

  const { error } =
    await window.sb
      .from("applications")
      .update({
        game_name: gameName,
        line_id: lineId
      })
      .eq("id", id);

  if (error) {
    console.error(error);

    alert(
      "บันทึกไม่สำเร็จ: " +
      error.message
    );

    return;
  }

  alert("บันทึกข้อมูลเรียบร้อยแล้ว");

  await loadAdmin();
}


// ============================
// DATE CHANGE
// ============================

adminDate.addEventListener(
  "change",
  loadAdmin
);


// ============================
// SECURITY HELPERS
// ============================

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}


// ============================
// CHECK EXISTING SESSION
// ============================

async function initAdmin() {
  const {
    data: { session }
  } = await window.sb.auth.getSession();

  if (!session) {
    return;
  }

  const isAdmin = await checkAdmin();

  if (isAdmin) {
    showPanel();
  } else {
    await window.sb.auth.signOut();
  }
}

initAdmin();
