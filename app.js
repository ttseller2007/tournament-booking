const times = [
  "13:00",
  "15:00",
  "17:00",
  "19:00",
  "21:00",
  "23:00",
  "01:00"
];

let selected = null;
let slots = [];

const dateEl = document.getElementById("date");

function localDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

dateEl.value = localDateString();

async function render() {
  const box = document.getElementById("slots");

  box.innerHTML = `
    <div class="card">
      กำลังโหลดรอบการแข่งขัน...
    </div>
  `;

  const { data, error } = await window.sb.rpc(
    "get_tournament_slots",
    {
      p_date: dateEl.value
    }
  );

  if (error) {
    console.error(error);

    box.innerHTML = `
      <div class="card">
        <b>เกิดข้อผิดพลาด</b>
        <p>ไม่สามารถโหลดรอบการแข่งขันได้</p>
      </div>
    `;

    return;
  }

  slots = data || [];

  box.innerHTML = "";

  slots.forEach(slot => {
    const count = Number(slot.team_count || 0);
    const max = Number(slot.max_teams || 8);
    const full = count >= max;

    const time = String(slot.match_time).slice(0, 5);

    box.innerHTML += `
      <div
        class="slot ${full ? "fullSlot" : ""}"
        onclick="choose('${time}')"
      >
        <div class="time">${time}</div>

        <div class="count ${full ? "full" : "open"}">
          ${count}/${max} ทีม • ${full ? "เต็ม" : "เปิดรับสมัคร"}
        </div>
      </div>
    `;
  });
}

function choose(time) {
  const slot = slots.find(
    x => String(x.match_time).slice(0, 5) === time
  );

  if (!slot) {
    alert("ไม่พบรอบการแข่งขัน");
    return;
  }

  const count = Number(slot.team_count || 0);
  const max = Number(slot.max_teams || 8);

  if (!slot.is_open || count >= max) {
    alert("รอบนี้เต็มแล้ว");
    return;
  }

  selected = slot;

  document.getElementById("chosen").textContent = time;

  document.getElementById("formBox").classList.remove("hidden");

  document.getElementById("msg").textContent = "";

  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: "smooth"
  });
}

async function submitApplication() {
  const gameName = document
    .getElementById("gameName")
    .value
    .trim();

  const lineId = document
    .getElementById("lineId")
    .value
    .trim();

  const fileInput = document.getElementById("slip");
  const file = fileInput.files[0];

  const msg = document.getElementById("msg");

  if (!selected) {
    alert("กรุณาเลือกเวลาการแข่งขัน");
    return;
  }

  if (!gameName || !lineId || !file) {
    alert("กรอกข้อมูลและแนบสลิปให้ครบ");
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

  if (!file.type.startsWith("image/")) {
    alert("กรุณาอัปโหลดไฟล์รูปภาพของสลิป");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert("ไฟล์สลิปต้องมีขนาดไม่เกิน 5 MB");
    return;
  }

  msg.textContent = "กำลังส่งข้อมูล...";

  const submitButton = document.querySelector(
    '#formBox button'
  );

  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    const extension =
      file.name.split(".").pop().toLowerCase() || "jpg";

    const safeExtension = [
      "jpg",
      "jpeg",
      "png",
      "webp"
    ].includes(extension)
      ? extension
      : "jpg";

    const fileName =
      `${dateEl.value}/${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;

    // อัปโหลดสลิปเข้า Storage
    const { error: uploadError } =
      await window.sb.storage
        .from("slips")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type
        });

    if (uploadError) {
      console.error(uploadError);
      throw new Error("ไม่สามารถอัปโหลดสลิปได้");
    }

    // ส่งข้อมูลสมัครผ่าน RPC
    // ระบบฝั่ง Supabase จะตรวจสอบจำนวนทีมอีกครั้ง
    const { data, error } =
      await window.sb.rpc(
        "create_application",
        {
          p_tournament_id: selected.id,
          p_game_name: gameName,
          p_line_id: lineId,
          p_slip_path: fileName
        }
      );

    if (error) {
      console.error(error);
      throw new Error(error.message || "สมัครไม่สำเร็จ");
    }

    console.log("Application ID:", data);

    msg.textContent =
      "สมัครเรียบร้อยแล้ว ✅ รอแอดมินตรวจสอบสลิป";

    document.getElementById("gameName").value = "";
    document.getElementById("lineId").value = "";
    document.getElementById("slip").value = "";

    selected = null;

    await render();

  } catch (error) {
    console.error(error);

    msg.textContent =
      "สมัครไม่สำเร็จ: " + error.message;

  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

dateEl.addEventListener("change", async () => {
  selected = null;

  document
    .getElementById("formBox")
    .classList.add("hidden");

  await render();
});

render();
