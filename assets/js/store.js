/* ==========================================================================
   Local data store — replaces the Flask + MySQL backend entirely.
   Everything lives in the browser's localStorage. No network calls,
   no server. Data is per-browser and will reset if storage is cleared.
   ========================================================================== */

const DB_KEYS = {
  users: "av_db_users",
  documents: "av_db_documents",
  notifications: "av_db_notifications",
  seeded: "av_db_seeded",
};

function _read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function _write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function uid(prefix = "") {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------------------------------------------------------------------- */
/* Seed data — creates a demo admin account the first time the app loads   */
/* ---------------------------------------------------------------------- */

function initStore() {
  if (localStorage.getItem(DB_KEYS.seeded)) return;

  const users = [
    {
      id: uid("u_"),
      full_name: "Admin",
      email: "admin@authvalidator.local",
      password: "Admin@12345",
      role: "super_admin",
      university: "Authenticity Validator HQ",
      is_verified: true,
      created_at: new Date().toISOString(),
    },
  ];
  _write(DB_KEYS.users, users);
  _write(DB_KEYS.documents, []);
  _write(DB_KEYS.notifications, []);
  localStorage.setItem(DB_KEYS.seeded, "1");
}

/* ---------------------------------------------------------------------- */
/* Users                                                                   */
/* ---------------------------------------------------------------------- */

const Users = {
  all: () => _read(DB_KEYS.users, []),
  save: (list) => _write(DB_KEYS.users, list),
  findByEmail: (email) =>
    Users.all().find((u) => u.email.toLowerCase() === String(email).toLowerCase()),
  findById: (id) => Users.all().find((u) => u.id === id),
  create: (user) => {
    const list = Users.all();
    list.push(user);
    Users.save(list);
    return user;
  },
  update: (id, patch) => {
    const list = Users.all();
    const idx = list.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    Users.save(list);
    return list[idx];
  },
  publicView: (user) => {
    if (!user) return null;
    const { password, ...rest } = user;
    return rest;
  },
};

/* ---------------------------------------------------------------------- */
/* Documents                                                               */
/* ---------------------------------------------------------------------- */

const Documents = {
  all: () => _read(DB_KEYS.documents, []),
  save: (list) => _write(DB_KEYS.documents, list),
  byUser: (userId) => Documents.all().filter((d) => d.user_id === userId),
  findById: (id) => Documents.all().find((d) => d.id === id),
  create: (doc) => {
    const list = Documents.all();
    list.push(doc);
    Documents.save(list);
    return doc;
  },
};

/* ---------------------------------------------------------------------- */
/* Notifications                                                          */
/* ---------------------------------------------------------------------- */

const Notifications = {
  all: () => _read(DB_KEYS.notifications, []),
  save: (list) => _write(DB_KEYS.notifications, list),
  byUser: (userId) =>
    Notifications.all()
      .filter((n) => n.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
  add: (userId, title, message) => {
    const list = Notifications.all();
    list.push({
      id: uid("n_"),
      user_id: userId,
      title,
      message,
      is_read: false,
      created_at: new Date().toISOString(),
    });
    Notifications.save(list);
  },
  markRead: (id) => {
    const list = Notifications.all();
    const idx = list.findIndex((n) => n.id === id);
    if (idx !== -1) {
      list[idx].is_read = true;
      Notifications.save(list);
    }
  },
};

initStore();
