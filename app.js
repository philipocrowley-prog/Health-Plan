const SUPABASE_URL = "https://vulhvjgddjdllfitsomy.supabase.co";
const SUPABASE_KEY = "sb_publishable_rR9AmQYhmjtUmd3vFHYL9Q_Lv3eHP9P";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

let currentUser = null;

/* =========================
   START
========================= */

document.addEventListener("DOMContentLoaded", async () => {
  setupEvents();

  const { data } = await supabaseClient.auth.getSession();

  if (data.session) {
    currentUser = data.session.user;
    showApp();
  } else {
    showLogin();
  }

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;

    if (currentUser) {
      showApp();
    } else {
      showLogin();
    }
  });
});

/* =========================
   EVENTS
========================= */

function setupEvents() {

  document
    .getElementById("loginForm")
    ?.addEventListener("submit", login);

  document
    .getElementById("signupButton")
    ?.addEventListener("click", signup);

  document
    .getElementById("logoutButton")
    ?.addEventListener("click", logout);

  document
    .getElementById("closeModal")
    ?.addEventListener("click", closeModal);

  document
    .getElementById("saveExercise")
    ?.addEventListener("click", saveExercise);

  document.querySelectorAll(".action-button").forEach(button => {
    button.addEventListener("click", () => {
      handleAction(button.dataset.action);
    });
  });
}

/* =========================
   AUTH
========================= */

async function login(event) {

  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  setText("authMessage", "Signing in...");

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    setText("authMessage", error.message);
  }
}

async function signup() {

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    setText("authMessage", "Enter an email and password first.");
    return;
  }

  setText("authMessage", "Creating account...");

  const { error } = await supabaseClient.auth.signUp({
    email,
    password
  });

  if (error) {
    setText("authMessage", error.message);
  } else {
    setText(
      "authMessage",
      "Account created. Check your email if confirmation is enabled."
    );
  }
}

async function logout() {
  await supabaseClient.auth.signOut();
}

function showLogin() {

  document
    .getElementById("loginScreen")
    ?.classList.remove("hidden");

  document
    .getElementById("appScreen")
    ?.classList.add("hidden");
}

async function showApp() {

  document
    .getElementById("loginScreen")
    ?.classList.add("hidden");

  document
    .getElementById("appScreen")
    ?.classList.remove("hidden");

  setGreeting();
  setTodayDate();

  await refreshDashboard();
  await loadExercise();
}

/* =========================
   DASHBOARD
========================= */

async function refreshDashboard() {

  if (!currentUser) return;

  const [
    weightResult,
    bpResult,
    symptomResult,
    fastingResult,
    exerciseResult
  ] = await Promise.all([

    supabaseClient
      .from("weight_entries")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("recorded_at", { ascending: false })
      .limit(100),

    supabaseClient
      .from("bp_readings")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("recorded_at", { ascending: false })
      .limit(100),

    supabaseClient
      .from("symptom_entries")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("recorded_at", { ascending: false })
      .limit(100),

    supabaseClient
      .from("fasting_entries")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("started_at", { ascending: false })
      .limit(50),

    supabaseClient
      .from("exercise_entries")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("exercise_date", { ascending: false })
      .limit(14)
  ]);

  if (weightResult.error) {
    console.error(weightResult.error);
  }

  if (bpResult.error) {
    console.error(bpResult.error);
  }

  if (symptomResult.error) {
    console.error(symptomResult.error);
  }

  if (fastingResult.error) {
    console.error(fastingResult.error);
  }

  if (exerciseResult.error) {
    console.error(exerciseResult.error);
  }

  const weights = weightResult.data || [];
  const bp = bpResult.data || [];
  const symptoms = symptomResult.data || [];
  const fasts = fastingResult.data || [];
  const exercises = exerciseResult.data || [];

  displayWeight(weights);
  displayBP(bp);
  displaySymptoms(symptoms);
  displayFasting(fasts);

  displaySummary(
    weights,
    bp,
    symptoms,
    fasts,
    exercises
  );

  checkSymptomAlert(symptoms);
}

/* =========================
   WEIGHT
========================= */

function displayWeight(entries) {

  if (!entries.length) {

    setText("latestWeight", "--");
    setText("weightChange", "No entries yet");

    return;
  }

  const latest = Number(entries[0].weight_kg);

  setText(
    "latestWeight",
    `${latest.toFixed(1)} kg`
  );

  if (entries.length > 1) {

    const previous = Number(entries[1].weight_kg);
    const difference = latest - previous;

    setText(
      "weightChange",
      `${difference > 0 ? "+" : ""}${difference.toFixed(1)} kg since previous`
    );

  } else {

    setText("weightChange", "First entry");

  }
}

/* =========================
   BLOOD PRESSURE
========================= */

function displayBP(entries) {

  if (!entries.length) {

    setText("latestBP", "--");
    setText("latestPulse", "Pulse --");

    return;
  }

  const latest = entries[0];

  setText(
    "latestBP",
    `${latest.systolic}/${latest.diastolic}`
  );

  setText(
    "latestPulse",
    latest.pulse
      ? `Pulse ${latest.pulse}`
      : "Pulse --"
  );
}

/* =========================
   SYMPTOMS
========================= */

function displaySymptoms(entries) {

  if (!entries.length) {

    setText("latestPins", "--");
    setText("latestTightness", "Tightness --");

    return;
  }

  const latest = entries[0];

  setText(
    "latestPins",
    `Pins ${score(latest.pins_score)}/10`
  );

  setText(
    "latestTightness",
    `Tightness ${score(latest.hamstring_tightness)}/10`
  );
}

/* =========================
   FASTING
========================= */

function displayFasting(entries) {

  const active = entries.find(
    fast => !fast.ended_at
  );

  if (active) {

    const duration =
      Date.now() -
      new Date(active.started_at).getTime();

    setText("fastStatus", "ACTIVE");
    setText(
      "fastDuration",
      formatDuration(duration)
    );

    return;
  }

  const completed = entries.find(
    fast => fast.ended_at
  );

  if (!completed) {

    setText("fastStatus", "None");
    setText("fastDuration", "No active fast");

    return;
  }

  const duration =
    new Date(completed.ended_at).getTime() -
    new Date(completed.started_at).getTime();

  setText("fastStatus", "Complete");
  setText(
    "fastDuration",
    formatDuration(duration)
  );
}

/* =========================
   7 DAY SUMMARY
========================= */

function displaySummary(
  weights,
  bp,
  symptoms,
  fasts,
  exercises
) {

  const sevenDaysAgo =
    Date.now() -
    7 * 24 * 60 * 60 * 1000;

  const recentWeights =
    weights.filter(
      x =>
        new Date(x.recorded_at).getTime()
        >= sevenDaysAgo
    );

  const recentBP =
    bp.filter(
      x =>
        new Date(x.recorded_at).getTime()
        >= sevenDaysAgo
    );

  const recentSymptoms =
    symptoms.filter(
      x =>
        new Date(x.recorded_at).getTime()
        >= sevenDaysAgo
    );

  const recentFasts =
    fasts.filter(
      x =>
        x.ended_at &&
        new Date(x.ended_at).getTime()
        >= sevenDaysAgo
    );

  /* Weight */

  if (recentWeights.length >= 2) {

    const newest =
      Number(recentWeights[0].weight_kg);

    const oldest =
      Number(
        recentWeights[recentWeights.length - 1]
          .weight_kg
      );

    const change = newest - oldest;

    setText(
      "summaryWeight",
      `${change > 0 ? "+" : ""}${change.toFixed(1)} kg`
    );

  } else {

    setText("summaryWeight", "--");

  }

  /* BP */

  if (recentBP.length) {

    const systolic =
      average(
        recentBP.map(x => Number(x.systolic))
      );

    const diastolic =
      average(
        recentBP.map(x => Number(x.diastolic))
      );

    setText(
      "summaryBP",
      `${Math.round(systolic)}/${Math.round(diastolic)}`
    );

  } else {

    setText("summaryBP", "--");

  }

  /* Symptoms */

  const pins =
    recentSymptoms
      .map(x => x.pins_score)
      .filter(x => x !== null);

  if (pins.length) {

    setText(
      "summaryPins",
      `${average(pins).toFixed(1)}/10`
    );

  } else {

    setText("summaryPins", "--");

  }

  /* Exercise */

  const weekdayExercises =
    exercises.filter(x => {

      const date =
        new Date(`${x.exercise_date}T12:00:00`);

      const day = date.getDay();

      return day >= 1 && day <= 5;
    });

  const completed =
    weekdayExercises.filter(
      x =>
        x.morning_squats_completed &&
        x.night_back_extension_completed
    ).length;

  setText(
    "summaryExercise",
    `${completed}/5`
  );

  /* Fasting */

  if (recentFasts.length) {

    const hours =
      recentFasts.map(x =>
        (
          new Date(x.ended_at).getTime() -
          new Date(x.started_at).getTime()
        ) / 3600000
      );

    setText(
      "summaryFasting",
      `${average(hours).toFixed(1)} h`
    );

  } else {

    setText("summaryFasting", "--");

  }
}

/* =========================
   SYMPTOM ALERT
========================= */

function checkSymptomAlert(entries) {

  const alert =
    document.getElementById("symptomAlert");

  if (!alert || entries.length < 2) return;

  const latest = entries[0];
  const previous = entries[1];

  const pinsIncrease =
    Number(latest.pins_score || 0) >=
    Number(previous.pins_score || 0) + 3;

  const weakness =
    latest.weakness === true &&
    previous.weakness !== true;

  const locationChange =
    latest.symptom_location &&
    previous.symptom_location &&
    latest.symptom_location !==
    previous.symptom_location;

  if (
    pinsIncrease ||
    weakness ||
    locationChange
  ) {

    alert.classList.remove("hidden");

  } else {

    alert.classList.add("hidden");

  }
}

/* =========================
   EXERCISE
========================= */

async function loadExercise() {

  const today = localDate();

  const { data, error } =
    await supabaseClient
      .from("exercise_entries")
      .select("*")
      .eq("user_id", currentUser.id)
      .eq("exercise_date", today)
      .maybeSingle();

  if (error) {
    console.error(error);
    return;
  }

  const day =
    new Date(`${today}T12:00:00`).getDay();

  const weekend =
    day === 0 || day === 6;

  setText(
    "exerciseDayType",
    weekend
      ? "Weekend / Recovery"
      : "Weekday"
  );

  if (data) {

    document.getElementById(
      "morningSquats"
    ).checked =
      !!data.morning_squats_completed;

    document.getElementById(
      "nightExtension"
    ).checked =
      !!data.night_back_extension_completed;

    document.getElementById(
      "bonusActivity"
    ).value =
      data.bonus_activity || "";

  } else {

    document.getElementById(
      "morningSquats"
    ).checked = false;

    document.getElementById(
      "nightExtension"
    ).checked = false;

    document.getElementById(
      "bonusActivity"
    ).value = "";
  }

  if (weekend) {

    document.getElementById(
      "morningSquats"
    ).checked = false;

    document.getElementById(
      "nightExtension"
    ).checked = false;
  }
}

async function saveExercise() {

  const today = localDate();

  const day =
    new Date(`${today}T12:00:00`).getDay();

  const weekend =
    day === 0 || day === 6;

  const payload = {

    user_id: currentUser.id,

    exercise_date: today,

    morning_squats_completed:
      weekend
        ? false
        : document.getElementById(
            "morningSquats"
          ).checked,

    night_back_extension_completed:
      weekend
        ? false
        : document.getElementById(
            "nightExtension"
          ).checked,

    bonus_activity:
      document.getElementById(
        "bonusActivity"
      ).value.trim() || null
  };

  const { error } =
    await supabaseClient
      .from("exercise_entries")
      .upsert(
        payload,
        {
          onConflict:
            "user_id,exercise_date"
        }
      );

  if (error) {

    console.error(error);
    toast(error.message);

    return;
  }

  toast("Exercise saved");

  await refreshDashboard();
}

/* =========================
   ACTIONS
========================= */

function handleAction(action) {

  if (action === "bp") {
    openBPForm();
  }

  if (action === "weight") {
    openWeightForm();
  }

  if (action === "symptoms") {
    openSymptomsForm();
  }

  if (action === "exercise") {

    document
      .getElementById("morningSquats")
      ?.scrollIntoView({
        behavior: "smooth"
      });
  }

  if (action === "startFast") {
    startFast();
  }

  if (action === "endFast") {
    endFast();
  }

  if (action === "note") {
    openNoteForm();
  }
}

/* =========================
   BP FORM
========================= */

function openBPForm() {

  openModal(`

    <h2>Blood Pressure</h2>

    <form id="bpForm">

      <div class="form-grid">

        <div class="form-group">
          <label>Systolic</label>
          <input
            id="bpSystolic"
            type="number"
            min="50"
            max="300"
            required
          >
        </div>

        <div class="form-group">
          <label>Diastolic</label>
          <input
            id="bpDiastolic"
            type="number"
            min="30"
            max="200"
            required
          >
        </div>

        <div class="form-group">
          <label>Pulse</label>
          <input
            id="bpPulse"
            type="number"
            min="20"
            max="250"
          >
        </div>

        <div class="form-group">

          <label>Context</label>

          <select id="bpContext">

            <option value="resting">
              Resting
            </option>

            <option value="before_medication">
              Before medication
            </option>

            <option value="after_medication">
              After medication
            </option>

            <option value="after_exercise">
              After exercise
            </option>

            <option value="other">
              Other
            </option>

          </select>

        </div>

        <div class="form-group full">

          <label>Symptoms / notes</label>

          <textarea
            id="bpSymptoms"
            rows="3"
          ></textarea>

        </div>

      </div>

      <div class="form-actions">

        <button
          type="submit"
          class="primary-button"
        >
          Save Reading
        </button>

      </div>

    </form>
  `);

  document
    .getElementById("bpForm")
    .addEventListener(
      "submit",
      saveBP
    );
}

async function saveBP(event) {

  event.preventDefault();

  const { error } =
    await supabaseClient
      .from("bp_readings")
      .insert({

        user_id:
          currentUser.id,

        systolic:
          Number(
            document.getElementById(
              "bpSystolic"
            ).value
          ),

        diastolic:
          Number(
            document.getElementById(
              "bpDiastolic"
            ).value
          ),

        pulse:
          document.getElementById(
            "bpPulse"
          ).value
            ? Number(
                document.getElementById(
                  "bpPulse"
                ).value
              )
            : null,

        context:
          document.getElementById(
            "bpContext"
          ).value,

        symptoms:
          document.getElementById(
            "bpSymptoms"
          ).value.trim() || null
      });

  if (error) {

    toast(error.message);
    return;
  }

  closeModal();
  toast("Blood pressure saved");

  await refreshDashboard();
}

/* =========================
   WEIGHT FORM
========================= */

function openWeightForm() {

  openModal(`

    <h2>Weight</h2>

    <form id="weightForm">

      <label>
        Weight (kg)
      </label>

      <input
        id="weightKg"
        type="number"
        min="1"
        max="500"
        step="0.1"
        required
      >

      <label>
        Notes
      </label>

      <textarea
        id="weightNotes"
        rows="3"
      ></textarea>

      <div class="form-actions">

        <button
          type="submit"
          class="primary-button"
        >
          Save Weight
        </button>

      </div>

    </form>
  `);

  document
    .getElementById("weightForm")
    .addEventListener(
      "submit",
      saveWeight
    );
}

async function saveWeight(event) {

  event.preventDefault();

  const weight =
    Number(
      document.getElementById(
        "weightKg"
      ).value
    );

  if (!weight) {

    toast("Enter a valid weight.");
    return;
  }

  const { error } =
    await supabaseClient
      .from("weight_entries")
      .insert({

        user_id:
          currentUser.id,

        weight_kg:
          weight,

        notes:
          document.getElementById(
            "weightNotes"
          ).value.trim() || null
      });

  if (error) {

    toast(error.message);
    return;
  }

  closeModal();

  toast("Weight saved");

  await refreshDashboard();
}

/* =========================
   SYMPTOM FORM
========================= */

function openSymptomsForm() {

  openModal(`

    <h2>Leg Symptoms</h2>

    <form id="symptomForm">

      <div class="form-grid">

        <div class="form-group">

          <label>
            Pins / needles (0–10)
          </label>

          <input
            id="pinsScore"
            type="number"
            min="0"
            max="10"
            required
          >

        </div>

        <div class="form-group">

          <label>
            Hamstring tightness (0–10)
          </label>

          <input
            id="tightnessScore"
            type="number"
            min="0"
            max="10"
          >

        </div>

        <div class="form-group full">

          <label>
            Location
          </label>

          <input
            id="symptomLocation"
            placeholder="Where are you feeling it?"
          >

        </div>

        <div class="form-group">

          <label>
            Trigger
          </label>

          <input id="symptomTrigger">

        </div>

        <div class="form-group">

          <label>
            Relief
          </label>

          <input id="symptomRelief">

        </div>

        <div class="form-group">

          <label>
            Sitting worse?
          </label>

          <select id="sittingWorse">

            <option value="">
              Not recorded
            </option>

            <option value="true">
              Yes
            </option>

            <option value="false">
              No
            </option>

          </select>

        </div>

        <div class="form-group">

          <label>
            Movement better?
          </label>

          <select id="movementBetter">

            <option value="">
              Not recorded
            </option>

            <option value="true">
              Yes
            </option>

            <option value="false">
              No
            </option>

          </select>

        </div>

        <div class="form-group">

          <label>
            Weakness?
          </label>

          <select id="weakness">

            <option value="false">
              No
            </option>

            <option value="true">
              Yes
            </option>

          </select>

        </div>

        <div class="form-group">

          <label>
            Compared with previous
          </label>

          <select id="symptomsCompared">

            <option value="">
              Not recorded
            </option>

            <option value="better">
              Better
            </option>

            <option value="same">
              Same
            </option>

            <option value="worse">
              Worse
            </option>

          </select>

        </div>

        <div class="form-group full">

          <label>
            Notes
          </label>

          <textarea
            id="symptomNotes"
            rows="3"
          ></textarea>

        </div>

      </div>

      <div class="form-actions">

        <button
          type="submit"
          class="primary-button"
        >
          Save Symptoms
        </button>

      </div>

    </form>
  `);

  document
    .getElementById("symptomForm")
    .addEventListener(
      "submit",
      saveSymptoms
    );
}

function nullableBoolean(id) {

  const value =
    document.getElementById(id).value;

  if (value === "") return null;

  return value === "true";
}

async function saveSymptoms(event) {

  event.preventDefault();

  const { error } =
    await supabaseClient
      .from("symptom_entries")
      .insert({

        user_id:
          currentUser.id,

        pins_score:
          Number(
            document.getElementById(
              "pinsScore"
            ).value
          ),

        hamstring_tightness:
          document.getElementById(
            "tightnessScore"
          ).value
            ? Number(
                document.getElementById(
                  "tightnessScore"
                ).value
              )
            : null,

        symptom_location:
          document.getElementById(
            "symptomLocation"
          ).value.trim() || null,

        trigger:
          document.getElementById(
            "symptomTrigger"
          ).value.trim() || null,

        relief:
          document.getElementById(
            "symptomRelief"
          ).value.trim() || null,

        sitting_worse:
          nullableBoolean("sittingWorse"),

        movement_better:
          nullableBoolean("movementBetter"),

        weakness:
          document.getElementById(
            "weakness"
          ).value === "true",

        symptoms_compared:
          document.getElementById(
            "symptomsCompared"
          ).value || null,

        notes:
          document.getElementById(
            "symptomNotes"
          ).value.trim() || null
      });

  if (error) {

    toast(error.message);
    return;
  }

  closeModal();

  toast("Symptoms saved");

  await refreshDashboard();
}

/* =========================
   FASTING
========================= */

async function startFast() {

  const { data: active } =
    await supabaseClient
      .from("fasting_entries")
      .select("id")
      .eq("user_id", currentUser.id)
      .is("ended_at", null)
      .maybeSingle();

  if (active) {

    toast("A fast is already active.");
    return;
  }

  const { error } =
    await supabaseClient
      .from("fasting_entries")
      .insert({

        user_id:
          currentUser.id,

        started_at:
          new Date().toISOString()
      });

  if (error) {

    toast(error.message);
    return;
  }

  toast("Fast started");

  await refreshDashboard();
}

async function endFast() {

  const { data: active } =
    await supabaseClient
      .from("fasting_entries")
      .select("id,started_at")
      .eq("user_id", currentUser.id)
      .is("ended_at", null)
      .maybeSingle();

  if (!active) {

    toast("There is no active fast.");
    return;
  }

  const ended =
    new Date();

  const duration =
    ended.getTime() -
    new Date(
      active.started_at
    ).getTime();

  const { error } =
    await supabaseClient
      .from("fasting_entries")
      .update({
        ended_at:
          ended.toISOString()
      })
      .eq(
        "id",
        active.id
      );

  if (error) {

    toast(error.message);
    return;
  }

  toast(
    `Fast ended: ${formatDuration(duration)}`
  );

  await refreshDashboard();
}

/* =========================
   NOTES
========================= */

function openNoteForm() {

  openModal(`

    <h2>Add Note</h2>

    <form id="noteForm">

      <label>
        Note
      </label>

      <textarea
        id="noteText"
        rows="6"
        required
      ></textarea>

      <div class="form-actions">

        <button
          type="submit"
          class="primary-button"
        >
          Save Note
        </button>

      </div>

    </form>
  `);

  document
    .getElementById("noteForm")
    .addEventListener(
      "submit",
      saveNote
    );
}

async function saveNote(event) {

  event.preventDefault();

  const note =
    document.getElementById(
      "noteText"
    ).value.trim();

  if (!note) return;

  const { error } =
    await supabaseClient
      .from("notes")
      .insert({

        user_id:
          currentUser.id,

        note
      });

  if (error) {

    toast(error.message);
    return;
  }

  closeModal();

  toast("Note saved");
}

/* =========================
   MODAL
========================= */

function openModal(html) {

  document.getElementById(
    "modalBody"
  ).innerHTML = html;

  document.getElementById(
    "modal"
  ).classList.remove("hidden");
}

function closeModal() {

  document.getElementById(
    "modal"
  ).classList.add("hidden");

  document.getElementById(
    "modalBody"
  ).innerHTML = "";
}

/* =========================
   HELPERS
========================= */

function setText(id, text) {

  const element =
    document.getElementById(id);

  if (element) {
    element.textContent = text;
  }
}

function toast(message) {

  const element =
    document.getElementById("toast");

  if (!element) return;

  element.textContent = message;

  element.classList.remove(
    "hidden"
  );

  clearTimeout(
    window.toastTimer
  );

  window.toastTimer =
    setTimeout(() => {

      element.classList.add(
        "hidden"
      );

    }, 2500);
}

function average(values) {

  if (!values.length) return 0;

  return values.reduce(
    (total, value) =>
      total + Number(value),
    0
  ) / values.length;
}

function score(value) {

  return value === null ||
    value === undefined
    ? "--"
    : Number(value);
}

function formatDuration(milliseconds) {

  if (
    !milliseconds ||
    milliseconds < 0
  ) {
    return "--";
  }

  const minutes =
    Math.floor(
      milliseconds / 60000
    );

  const hours =
    Math.floor(
      minutes / 60
    );

  const remaining =
    minutes % 60;

  if (!hours) {
    return `${remaining}m`;
  }

  return `${hours}h ${remaining}m`;
}

function localDate() {

  const date =
    new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function setTodayDate() {

  setText(
    "todayDate",
    new Date().toLocaleDateString(
      "en-IE",
      {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric"
      }
    )
  );
}

function setGreeting() {

  const hour =
    new Date().getHours();

  let greeting =
    "Today";

  if (hour < 12) {
    greeting = "Good morning";
  } else if (hour < 18) {
    greeting = "Good afternoon";
  } else {
    greeting = "Good evening";
  }

  setText(
    "greeting",
    greeting
  );
}
