/* ==========================================================================
   Api — fully client-side now. No server, no network requests.
   Keeps the exact same function names/shapes the HTML pages already call,
   so none of the page scripts needed to change.
   ========================================================================== */

/* ---- session (token is just a local marker, not a real JWT) ----------- */

function getToken() {
  return localStorage.getItem("av_token");
}
function setToken(token) {
  localStorage.setItem("av_token", token);
}
function clearToken() {
  localStorage.removeItem("av_token");
  localStorage.removeItem("av_user");
}
function getUser() {
  const raw = localStorage.getItem("av_user");
  return raw ? JSON.parse(raw) : null;
}
function setUser(user) {
  localStorage.setItem("av_user", JSON.stringify(user));
}

function requireAuth() {
  if (!getToken()) {
    window.location.href = "login.html";
  }
}
function logout() {
  clearToken();
  window.location.href = "login.html";
}

function currentUserId() {
  const token = getToken();
  if (!token || !token.startsWith("local-")) return null;
  return token.slice(6);
}

function isAdmin(user) {
  return !!user && ["admin", "super_admin"].includes(user.role);
}

/* ---- status helpers ----------------------------------------------------- */

function statusFromVerdict(verdict) {
  if (verdict === "authentic") return "verified";
  if (verdict === "plagiarized") return "rejected";
  return "pending";
}

/* ---- Api ------------------------------------------------------------- */

const Api = {
  register: async ({ full_name, email, password, role, university }) => {
    if (!full_name || !email || !password) {
      return { ok: false, data: { message: "All fields are required" } };
    }
    if (Users.findByEmail(email)) {
      return { ok: false, data: { message: "An account with that email already exists" } };
    }
    const user = Users.create({
      id: uid("u_"),
      full_name,
      email,
      password,
      role: role || "student",
      university: university || null,
      is_verified: true,
      created_at: new Date().toISOString(),
    });
    return { ok: true, data: { message: "Account created", user: Users.publicView(user) } };
  },

  login: async ({ email, password }) => {
    const user = Users.findByEmail(email);
    if (!user || user.password !== password) {
      return { ok: false, data: { message: "Invalid email or password" } };
    }
    const token = "local-" + user.id;
    return { ok: true, data: { token, user: Users.publicView(user) } };
  },

  forgotPassword: async ({ email }) => {
    const user = Users.findByEmail(email);
    if (!user) {
      return { ok: false, data: { message: "No account found with that email" } };
    }
    return { ok: true, data: { message: "You can reset your password now" } };
  },

  resetPassword: async ({ email, new_password }) => {
    const user = Users.findByEmail(email);
    if (!user) {
      return { ok: false, data: { message: "No account found with that email" } };
    }
    if (!new_password || new_password.length < 6) {
      return { ok: false, data: { message: "Password must be at least 6 characters" } };
    }
    Users.update(user.id, { password: new_password });
    return { ok: true, data: { message: "Password reset" } };
  },

  me: async () => {
    const user = Users.findById(currentUserId());
    if (!user) return { ok: false, data: { message: "Not authenticated" } };
    return { ok: true, data: { user: Users.publicView(user) } };
  },

  /* -------------------------------------------------------------------- */
  /* Upload + analysis                                                    */
  /* -------------------------------------------------------------------- */

  upload: async (formData) => {
    const userId = currentUserId();
    const user = Users.findById(userId);
    if (!user) return { ok: false, data: { message: "Not authenticated" } };

    const file = formData.get("file");
    const docType = formData.get("doc_type") || "document";
    if (!file) return { ok: false, data: { message: "No file provided" } };

    const fileType = file.name.split(".").pop().toLowerCase();
    const text = await extractText(file);

    const doc = {
      id: uid("d_"),
      user_id: userId,
      original_filename: file.name,
      file_type: fileType,
      doc_type: docType,
      status: "pending",
      extracted_text: text,
      created_at: new Date().toISOString(),
    };

    if (docType === "certificate") {
      const cert = await verifyCertificate(text || "");
      doc.certificate_verification = cert;
      doc.authenticity_score = cert.hash_match ? 95 : cert.qr_found ? 40 : 0;
      doc.status = cert.verdict === "authentic" ? "verified" : cert.verdict === "no_qr_found" ? "pending" : "rejected";
      Documents.create(doc);
      Notifications.add(
        userId,
        "Certificate processed",
        `"${file.name}" was analyzed — verdict: ${cert.verdict.replace(/_/g, " ")}.`
      );
      return { ok: true, data: { document: doc, certificate_verification: cert } };
    }

    const analysis = runFullAnalysis(text || "");
    doc.analysis = analysis;
    doc.authenticity_score = analysis.authenticity_score;
    doc.plagiarism_percentage = analysis.plagiarism.plagiarism_percentage;
    doc.ai_content_percentage = analysis.ai_detection.ai_content_percentage;
    doc.citation_accuracy = analysis.citations.citation_accuracy;
    doc.grammar_score = analysis.grammar.grammar_score;
    doc.status = statusFromVerdict(analysis.verdict);

    Documents.create(doc);
    Notifications.add(
      userId,
      "Document analyzed",
      `"${file.name}" scored ${analysis.authenticity_score}/100 — ${analysis.verdict}.`
    );

    return { ok: true, data: { document: doc, analysis } };
  },

  /* -------------------------------------------------------------------- */
  /* Dashboard / history / notifications / admin                          */
  /* -------------------------------------------------------------------- */

  stats: async () => {
    const user = Users.findById(currentUserId());
    if (!user) return { ok: false, data: { message: "Not authenticated" } };

    const docs = isAdmin(user) ? Documents.all() : Documents.byUser(user.id);
    const total = docs.length;
    const verified = docs.filter((d) => d.status === "verified").length;
    const rejected = docs.filter((d) => d.status === "rejected").length;
    const pending = docs.filter((d) => ["pending", "processing"].includes(d.status)).length;
    const certificates = docs.filter((d) => d.doc_type === "certificate").length;

    const avg = (key) => (docs.length ? docs.reduce((s, d) => s + (d[key] || 0), 0) / docs.length : 0);

    const payload = {
      total_documents: total,
      verified,
      rejected,
      pending,
      certificates,
      avg_authenticity_score: Math.round(avg("authenticity_score") * 100) / 100,
      avg_ai_content_percentage: Math.round(avg("ai_content_percentage") * 100) / 100,
      avg_plagiarism_percentage: Math.round(avg("plagiarism_percentage") * 100) / 100,
    };

    if (isAdmin(user)) {
      payload.total_users = Users.all().length;
      payload.total_universities = new Set(
        Users.all().map((u) => u.university).filter(Boolean)
      ).size;
    }

    return { ok: true, data: { stats: payload } };
  },

  history: async (params = {}) => {
    const user = Users.findById(currentUserId());
    if (!user) return { ok: false, data: { message: "Not authenticated" } };

    let docs = isAdmin(user) ? Documents.all() : Documents.byUser(user.id);
    if (params.status) docs = docs.filter((d) => d.status === params.status);
    if (params.search) {
      const q = params.search.toLowerCase();
      docs = docs.filter((d) => d.original_filename.toLowerCase().includes(q));
    }
    docs = docs.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const page = parseInt(params.page || 1, 10);
    const perPage = parseInt(params.per_page || 10, 10);
    const total = docs.length;
    const pages = Math.max(1, Math.ceil(total / perPage));
    const pageItems = docs.slice((page - 1) * perPage, page * perPage);

    return { ok: true, data: { documents: pageItems, total, page, pages } };
  },

  notifications: async () => {
    const userId = currentUserId();
    if (!userId) return { ok: false, data: { message: "Not authenticated" } };
    return { ok: true, data: { notifications: Notifications.byUser(userId).slice(0, 20) } };
  },

  markNotificationRead: async (id) => {
    Notifications.markRead(id);
    return { ok: true, data: {} };
  },

  adminUsers: async () => {
    const user = Users.findById(currentUserId());
    if (!isAdmin(user)) return { ok: false, data: { message: "Forbidden" } };
    const users = Users.all()
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(Users.publicView);
    return { ok: true, data: { users } };
  },
};
